import { Injectable } from '@nestjs/common';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { Notification, CreateNotificationInput } from '../models/Notification';

@Injectable()
export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    return this.repo.create(input);
  }

  async list(businessId: string, limit = 30): Promise<Notification[]> {
    return this.repo.listByBusiness(businessId, limit);
  }

  async countUnread(businessId: string): Promise<number> {
    return this.repo.countUnread(businessId);
  }

  async markRead(businessId: string, id: string, createdAt: string): Promise<void> {
    return this.repo.markRead(businessId, id, createdAt);
  }

  async markAllRead(businessId: string): Promise<void> {
    return this.repo.markAllRead(businessId);
  }

  // ---------------------------------------------------------------------------
  // Convenience emit helpers — called from other services
  // ---------------------------------------------------------------------------

  async emitInvoiceCreated(businessId: string, invoiceId: string, customerName: string, amount: number, currency: string) {
    await this.create({
      businessId,
      type: 'invoice.created',
      title: 'Invoice created',
      body: `Invoice for ${customerName} — ${amount.toLocaleString()} ${currency}`,
      link: `/invoices/${invoiceId}`,
      refId: invoiceId,
    });
  }

  async emitInvoicePaid(businessId: string, invoiceId: string, customerName: string, amount: number, currency: string) {
    await this.create({
      businessId,
      type: 'invoice.paid',
      title: 'Invoice paid 🎉',
      body: `${customerName} paid ${amount.toLocaleString()} ${currency}`,
      link: `/invoices/${invoiceId}`,
      refId: invoiceId,
    });
  }

  async emitPaymentReceived(businessId: string, invoiceId: string, amount: number, currency: string) {
    await this.create({
      businessId,
      type: 'payment.received',
      title: 'Payment received',
      body: `You received ${amount.toLocaleString()} ${currency}`,
      link: `/invoices/${invoiceId}`,
      refId: invoiceId,
    });
  }

  async emitTeamMemberJoined(businessId: string, memberName: string, userId: string) {
    await this.create({
      businessId,
      type: 'team.member_joined',
      title: 'New team member',
      body: `${memberName} joined your team`,
      refId: userId,
    });
  }

  async emitTeamMemberInvited(businessId: string, email: string) {
    await this.create({
      businessId,
      type: 'team.member_invited',
      title: 'Invitation sent',
      body: `An invitation was sent to ${email}`,
    });
  }

  async emitDebtReminder(businessId: string, customerName: string, amount: number, currency: string, debtId: string) {
    await this.create({
      businessId,
      type: 'debt.reminder',
      title: 'Debt reminder sent',
      body: `Reminder sent to ${customerName} for ${amount.toLocaleString()} ${currency}`,
      refId: debtId,
    });
  }

  async emitPlanUpgraded(businessId: string, planName: string) {
    await this.create({
      businessId,
      type: 'plan.upgraded',
      title: 'Plan upgraded',
      body: `Your plan was upgraded to ${planName}`,
      link: '/settings',
    });
  }
}
