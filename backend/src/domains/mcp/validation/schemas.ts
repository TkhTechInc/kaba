import { z } from 'zod';

// Date validation
const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD');

const DateRangeBaseSchema = z.object({
  startDate: DateStringSchema,
  endDate: DateStringSchema,
});

const dateRangeRefines = <T extends z.ZodType<{ startDate: string; endDate: string }>>(schema: T) =>
  schema
    .refine((data) => data.startDate <= data.endDate, { message: 'startDate must be before or equal to endDate' })
    .refine((data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 365;
    }, { message: 'Date range cannot exceed 365 days' });

// Invoice item schema
const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(1000000),
  unitPrice: z.number().positive().max(1000000000),
  amount: z.number().positive().max(1000000000),
});

// Bulk invoices schema
export const BulkInvoicesInputSchema = z.object({
  invoices: z.array(z.object({
    customerId: z.string().min(1),
    amount: z.number().positive().max(1000000000),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    dueDate: DateStringSchema.optional(),
    description: z.string().max(500).optional(),
    items: z.array(InvoiceItemSchema).max(100).optional(),
  })).min(1).max(100), // Max 100 invoices per batch
  sendPaymentLink: z.boolean().default(true),
});

// Tax report schema
export const TaxReportInputSchema = dateRangeRefines(
  DateRangeBaseSchema.extend({
    includeVAT: z.boolean().default(true),
    vatRate: z.number().min(0).max(100).default(18),
  }),
);

// Reconciliation schema
export const ReconciliationInputSchema = dateRangeRefines(
  DateRangeBaseSchema.extend({
    autoReconcile: z.boolean().default(false),
  }),
);

// Cash shortage prediction schema
export const CashShortageInputSchema = z.object({
  daysAhead: z.number().int().min(1).max(90).default(30),
  includeRecommendations: z.boolean().default(true),
});

// Type exports
export type BulkInvoicesInput = z.infer<typeof BulkInvoicesInputSchema>;
export type TaxReportInput = z.infer<typeof TaxReportInputSchema>;
export type ReconciliationInput = z.infer<typeof ReconciliationInputSchema>;
export type CashShortageInput = z.infer<typeof CashShortageInputSchema>;
