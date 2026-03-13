export type NotificationType =
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'payment.received'
  | 'team.member_joined'
  | 'team.member_invited'
  | 'debt.reminder'
  | 'plan.upgraded'
  | 'plan.expiring';

export interface Notification {
  id: string;
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Optional deep-link inside the app, e.g. /invoices/abc123 */
  link?: string;
  /** Optional reference entity id (invoice, user, etc.) */
  refId?: string;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  refId?: string;
}
