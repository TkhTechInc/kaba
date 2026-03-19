/**
 * SNS Lambda handler for payment events from the TKH Payments microservice.
 *
 * Triggered by SNS topic: arn:aws:sns:ca-central-1:497172038983:tkhtech-payment-events-dev
 *
 * On payment.completed where appId=kaba, marks the referenced invoice as paid
 * and creates a ledger sale entry.
 * On payment.refunded, marks the invoice as refunded and creates a reverse ledger entry.
 */
import type { SNSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';

interface PaymentEvent {
  type: string;
  appId: string;
  referenceId: string;
  businessId?: string;
  amount: number;
  currency: string;
  gatewayTransactionId?: string;
  intentId?: string;
  refundId?: string;
  [key: string]: unknown;
}

const invoicesTableName =
  process.env['DYNAMODB_INVOICES_TABLE'] ?? 'Kaba-Invoices-dev';
const ledgerTableName =
  process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-Ledger-dev';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const invoiceRepo = new InvoiceRepository(docClient, invoicesTableName);
const ledgerRepo = new LedgerRepository(docClient, ledgerTableName);

export async function handler(event: SNSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const raw = JSON.parse(record.Sns.Message) as PaymentEvent;

      if (raw.appId !== 'kaba') {
        console.log(`[PaymentEventHandler] Ignoring event for appId: ${raw.appId}`);
        continue;
      }

      if (raw.type === 'payment.completed') {
        await handlePaymentCompleted(raw);
      } else if (raw.type === 'payment.refunded') {
        await handlePaymentRefunded(raw);
      } else {
        console.log(`[PaymentEventHandler] Ignoring event type: ${raw.type}`);
      }
    } catch (err) {
      console.error('[PaymentEventHandler] Error processing SNS record:', err);
      // Don't rethrow — Lambda will retry the entire batch.
      // Individual record errors are logged; SNS delivery retries handle the rest.
    }
  }
}

async function handlePaymentCompleted(raw: PaymentEvent): Promise<void> {
  const invoiceId = raw.referenceId;
  const businessId = raw.businessId ?? (raw.metadata as Record<string, string> | undefined)?.['businessId'];

  if (!invoiceId || !businessId) {
    console.warn('[PaymentEventHandler] Missing referenceId or businessId — skipping');
    return;
  }

  // Skip plan/storefront payments (referenceId format: plan-{token}, storefront-{token})
  if (invoiceId.startsWith('plan-') || invoiceId.startsWith('storefront-')) {
    return;
  }

  const invoice = await invoiceRepo.getById(businessId, invoiceId);
  if (!invoice) {
    console.warn(`[PaymentEventHandler] Invoice ${invoiceId} not found for business ${businessId}`);
    return;
  }

  if (invoice.status === 'paid') {
    console.log(`[PaymentEventHandler] Invoice ${invoiceId} already paid — skipping`);
    return;
  }

  const intentId = raw.intentId as string | undefined;
  const updated = await invoiceRepo.updateStatusWithPaymentIntent(
    businessId,
    invoiceId,
    'paid',
    intentId,
  );
  if (updated) {
    console.log(`[PaymentEventHandler] Invoice ${invoiceId} marked as paid`);

    try {
      const today = new Date().toISOString().slice(0, 10);
      await ledgerRepo.create({
        businessId: updated.businessId,
        type: 'sale',
        amount: updated.amount,
        currency: updated.currency,
        description: `Invoice #${updated.id.slice(0, 8)} paid`,
        category: 'Sales',
        date: today,
      });
      console.log(`[PaymentEventHandler] Ledger entry created for invoice ${invoiceId}`);
    } catch (ledgerErr) {
      console.error('[PaymentEventHandler] Failed to create ledger entry:', ledgerErr);
    }
  }
}

async function handlePaymentRefunded(raw: PaymentEvent): Promise<void> {
  const invoiceId = raw.referenceId;
  const businessId = raw.businessId ?? (raw.metadata as Record<string, string> | undefined)?.['businessId'];

  if (!invoiceId || !businessId) {
    console.warn('[PaymentEventHandler] Missing referenceId or businessId — skipping');
    return;
  }

  if (invoiceId.startsWith('plan-') || invoiceId.startsWith('storefront-')) {
    return;
  }

  const invoice = await invoiceRepo.getById(businessId, invoiceId);
  if (!invoice) {
    console.warn(`[PaymentEventHandler] Invoice ${invoiceId} not found for business ${businessId}`);
    return;
  }

  if (invoice.status === 'refunded') {
    console.log(`[PaymentEventHandler] Invoice ${invoiceId} already refunded — skipping`);
    return;
  }

  const updated = await invoiceRepo.updateStatusWithPaymentIntent(
    businessId,
    invoiceId,
    'refunded',
  );
  if (updated) {
    console.log(`[PaymentEventHandler] Invoice ${invoiceId} marked as refunded`);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const refundAmount = raw.amount ?? invoice.amount;
      await ledgerRepo.create({
        businessId: updated.businessId,
        type: 'expense',
        amount: refundAmount,
        currency: updated.currency,
        description: `Refund: Invoice #${updated.id.slice(0, 8)}`,
        category: 'Refunds',
        date: today,
      });
      console.log(`[PaymentEventHandler] Refund ledger entry created for invoice ${invoiceId}`);
    } catch (ledgerErr) {
      console.error('[PaymentEventHandler] Failed to create refund ledger entry:', ledgerErr);
    }
  }
}
