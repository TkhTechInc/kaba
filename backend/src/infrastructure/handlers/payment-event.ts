/**
 * SNS Lambda handler for payment events from the TKH Payments microservice.
 *
 * Triggered by SNS topic: arn:aws:sns:ca-central-1:497172038983:tkhtech-payment-events-dev
 *
 * On payment.completed where appId=kaba, marks the referenced invoice as paid
 * and creates a ledger sale entry.
 */
import type { SNSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';

interface PaymentCompletedEvent {
  type: string;
  appId: string;
  referenceId: string;
  businessId?: string;
  amount: number;
  currency: string;
  gatewayTransactionId?: string;
  intentId?: string;
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
      const raw = JSON.parse(record.Sns.Message) as PaymentCompletedEvent;

      if (raw.type !== 'payment.completed') {
        console.log(`[PaymentEventHandler] Ignoring event type: ${raw.type}`);
        continue;
      }

      if (raw.appId !== 'kaba') {
        console.log(`[PaymentEventHandler] Ignoring event for appId: ${raw.appId}`);
        continue;
      }

      const invoiceId = raw.referenceId;
      const businessId = raw.businessId ?? (raw.metadata as Record<string, string> | undefined)?.['businessId'];

      if (!invoiceId || !businessId) {
        console.warn('[PaymentEventHandler] Missing referenceId or businessId — skipping');
        continue;
      }

      const invoice = await invoiceRepo.getById(businessId, invoiceId);
      if (!invoice) {
        console.warn(`[PaymentEventHandler] Invoice ${invoiceId} not found for business ${businessId}`);
        continue;
      }

      if (invoice.status === 'paid') {
        console.log(`[PaymentEventHandler] Invoice ${invoiceId} already paid — skipping`);
        continue;
      }

      const updated = await invoiceRepo.updateStatus(businessId, invoiceId, 'paid');
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
    } catch (err) {
      console.error('[PaymentEventHandler] Error processing SNS record:', err);
      // Don't rethrow — Lambda will retry the entire batch.
      // Individual record errors are logged; SNS delivery retries handle the rest.
    }
  }
}
