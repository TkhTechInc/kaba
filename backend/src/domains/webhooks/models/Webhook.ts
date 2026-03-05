export type WebhookEvent =
  | 'ledger.entry.created'
  | 'ledger.entry.deleted'
  | 'invoice.paid'
  | 'invoice.created'
  | 'payment.received'
  | 'inventory.low_stock';

export interface Webhook {
  id: string;
  businessId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: string;
}

export interface CreateWebhookInput {
  businessId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
}
