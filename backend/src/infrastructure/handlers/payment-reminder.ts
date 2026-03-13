/**
 * Standalone Lambda handler for sending payment reminders for overdue/pending debts.
 * Runs on EventBridge schedule (daily at 8am UTC).
 * Uses DynamoDB + repositories directly (no Nest bootstrap).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { MetaCloudWhatsAppProvider } from '@/domains/notifications/providers/MetaCloudWhatsAppProvider';
import { AwsSnsSmsProvider } from '@/domains/notifications/providers/AwsSnsSmsProvider';

const tableName = process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-Ledger-dev';
const whatsappToken = process.env['WHATSAPP_TOKEN'] ?? '';
const whatsappPhoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const debtRepo = new DebtRepository(docClient, tableName);

const whatsApp =
  whatsappToken && whatsappPhoneNumberId
    ? new MetaCloudWhatsAppProvider(whatsappToken, whatsappPhoneNumberId)
    : null;

const smsProvider = new AwsSnsSmsProvider(null);

function buildReminderMessage(debtorName: string, currency: string, amount: number, dueDate: string): string {
  return `Reminder: ${debtorName} owes ${currency} ${amount}. Due: ${dueDate}. Please pay at your earliest convenience.`;
}

export async function handler(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const reminderThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const errors: string[] = [];
  let sent = 0;

  const debts = await debtRepo.scanOverdue(today, reminderThreshold);
  console.log(`[PaymentReminderHandler] Found ${debts.length} debts needing reminders`);

  for (const debt of debts) {
    if (!debt.phone) continue;

    const message = buildReminderMessage(debt.debtorName, debt.currency, debt.amount, debt.dueDate);

    try {
      let success = false;

      if (whatsApp) {
        const result = await whatsApp.send(debt.phone, message);
        success = result.success;
      }

      if (!success) {
        const result = await smsProvider.send(debt.phone, message);
        success = result.success;
      }

      if (success) {
        sent++;
        debt.lastReminderSentAt = new Date().toISOString();
        debt.updatedAt = debt.lastReminderSentAt;
        await debtRepo.update(debt);
      } else {
        errors.push(`Failed to send reminder for debt ${debt.id} (${debt.debtorName})`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Error processing debt ${debt.id}: ${msg}`);
      console.error(`[PaymentReminderHandler] Error for debt ${debt.id}:`, e);
    }
  }

  console.log(
    `[PaymentReminderHandler] Processed ${debts.length} debts, sent ${sent} reminders, ${errors.length} errors`,
  );

  return { processed: debts.length, sent, errors };
}
