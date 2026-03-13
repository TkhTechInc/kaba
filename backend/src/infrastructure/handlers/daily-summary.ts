/**
 * Daily Summary Lambda — runs daily at 7am UTC via EventBridge.
 * Sends each opted-in business owner a WhatsApp/SMS summary of yesterday's activity.
 * Uses repositories directly (no Nest bootstrap).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { MetaCloudWhatsAppProvider } from '@/domains/notifications/providers/MetaCloudWhatsAppProvider';
import { AwsSnsSmsProvider } from '@/domains/notifications/providers/AwsSnsSmsProvider';

const tableName = process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-Ledger-dev';
const whatsappToken = process.env['WHATSAPP_TOKEN'] ?? '';
const whatsappPhoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ledgerRepo = new LedgerRepository(docClient, tableName);
const debtRepo = new DebtRepository(docClient, tableName);

const whatsApp =
  whatsappToken && whatsappPhoneNumberId
    ? new MetaCloudWhatsAppProvider(whatsappToken, whatsappPhoneNumberId)
    : null;

const smsProvider = new AwsSnsSmsProvider(null);

interface BusinessMeta {
  businessId: string;
  phone?: string;
  currency?: string;
  name?: string;
  dailySummaryEnabled?: boolean;
}

/**
 * Scan the ledger table for all business META records.
 * pk = businessId, sk = 'META', entityType = 'BUSINESS'
 */
async function scanBusinesses(): Promise<BusinessMeta[]> {
  const businesses: BusinessMeta[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: 'sk = :meta AND entityType = :biz',
        ExpressionAttributeValues: {
          ':meta': 'META',
          ':biz': 'BUSINESS',
        },
        ProjectionExpression: 'pk, #nm, phone, currency, dailySummaryEnabled',
        ExpressionAttributeNames: { '#nm': 'name' },
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      } as import('@aws-sdk/lib-dynamodb').ScanCommandInput),
    );

    for (const item of result.Items ?? []) {
      businesses.push({
        businessId: String(item.pk ?? ''),
        phone: item.phone != null ? String(item.phone) : undefined,
        currency: item.currency != null ? String(item.currency) : 'NGN',
        name: item.name != null ? String(item.name) : undefined,
        dailySummaryEnabled: item.dailySummaryEnabled === true,
      });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return businesses;
}

function formatAmount(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildSummaryMessage(
  date: string,
  currency: string,
  sales: number,
  expenses: number,
  debtCount: number,
  debtTotal: number,
): string {
  const profit = sales - expenses;
  const profitSign = profit >= 0 ? '' : '-';
  const profitAbs = Math.abs(profit);

  return [
    `📊 Résumé du jour — Kaba AI`,
    ``,
    `📅 ${date}`,
    ``,
    `💰 Ventes: ${formatAmount(currency, sales)}`,
    `💸 Dépenses: ${formatAmount(currency, expenses)}`,
    `📈 Profit: ${profitSign}${formatAmount(currency, profitAbs)}`,
    ``,
    `💳 Dettes en attente: ${debtCount} (${formatAmount(currency, debtTotal)})`,
    ``,
    `---`,
    `Daily Summary — Kaba AI`,
    `Sales: ${formatAmount(currency, sales)}`,
    `Expenses: ${formatAmount(currency, expenses)}`,
    `Profit: ${profitSign}${formatAmount(currency, profitAbs)}`,
    `Outstanding debts: ${debtCount}`,
  ].join('\n');
}

export async function handler(
  event?: { businessIds?: string[] },
): Promise<{ processed: number; sent: number; errors: string[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const errors: string[] = [];
  let sent = 0;
  let processed = 0;

  // Resolve the list of businesses to process
  let businesses: BusinessMeta[];

  if (event?.businessIds && event.businessIds.length > 0) {
    // Targeted invocation from EventBridge with explicit business list
    businesses = event.businessIds.map((id) => ({ businessId: id, dailySummaryEnabled: true }));
  } else {
    // Full scan — filter to opted-in businesses only
    const all = await scanBusinesses();
    businesses = all.filter((b) => b.dailySummaryEnabled);
  }

  console.log(`[DailySummaryHandler] Processing ${businesses.length} businesses for date ${yesterday}`);

  for (const biz of businesses) {
    processed++;
    const { businessId, phone, currency = 'NGN' } = biz;

    if (!phone) {
      console.warn(`[DailySummaryHandler] Business ${businessId} has no phone — skipping`);
      continue;
    }

    try {
      // Fetch yesterday's ledger entries
      const entries = await ledgerRepo.listByBusinessAndDateRange(businessId, yesterday, yesterday);

      let sales = 0;
      let expenses = 0;
      for (const e of entries) {
        if (e.type === 'sale') sales += e.amount;
        else expenses += e.amount;
      }

      // Fetch pending/overdue debts
      const { items: pendingDebts } = await debtRepo.listByBusiness(businessId, 1, 1000, 'pending');
      const { items: overdueDebts } = await debtRepo.listByBusiness(businessId, 1, 1000, 'overdue');
      const allUnpaid = [...pendingDebts, ...overdueDebts];
      const debtCount = allUnpaid.length;
      const debtTotal = allUnpaid.reduce((sum, d) => sum + d.amount, 0);

      const message = buildSummaryMessage(today, currency, sales, expenses, debtCount, debtTotal);

      let success = false;

      if (whatsApp) {
        const result = await whatsApp.send(phone, message);
        success = result.success;
      }

      if (!success) {
        const result = await smsProvider.send(phone, message);
        success = result.success;
      }

      if (success) {
        sent++;
        console.log(`[DailySummaryHandler] Sent summary to ${businessId} (${phone})`);
      } else {
        errors.push(`Failed to send summary for business ${businessId} (${phone})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Error processing business ${businessId}: ${msg}`);
      console.error(`[DailySummaryHandler] Error for business ${businessId}:`, e);
    }
  }

  console.log(
    `[DailySummaryHandler] Processed ${processed} businesses, sent ${sent} summaries, ${errors.length} errors`,
  );

  return { processed, sent, errors };
}
