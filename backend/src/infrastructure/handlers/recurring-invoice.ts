/**
 * Standalone Lambda handler for processing due recurring invoice schedules.
 * Runs on EventBridge schedule (e.g. daily at 6am).
 * Uses DynamoDB + repositories directly (no Nest bootstrap).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { RecurringInvoiceRepository } from '@/domains/invoicing/repositories/RecurringInvoiceRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { RecurringInvoiceService } from '@/domains/invoicing/services/RecurringInvoiceService';

const tableName =
  process.env['DYNAMODB_INVOICES_TABLE'] ?? 'Kaba-Invoices-dev';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const recurringRepo = new RecurringInvoiceRepository(docClient, tableName);
const invoiceRepo = new InvoiceRepository(docClient, tableName);
const recurringService = new RecurringInvoiceService(
  recurringRepo,
  invoiceRepo
);

export async function handler(): Promise<{
  processed: number;
  invoices: string[];
  success: boolean;
}> {
  try {
    const result = await recurringService.processDueSchedules();
    console.log(
      `[RecurringInvoiceHandler] Processed ${result.processed} schedules, created ${result.invoices.length} invoices`
    );
    return {
      ...result,
      success: true,
    };
  } catch (e) {
    console.error('[RecurringInvoiceHandler] Error:', e);
    throw e;
  }
}
