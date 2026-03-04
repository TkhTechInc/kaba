import { Inject, Optional } from '@nestjs/common';
import { InvoiceRepository, ListByBusinessResult } from '../repositories/InvoiceRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { Invoice, CreateInvoiceInput } from '../models/Invoice';
import { PaymentGatewayManager } from '@/domains/payments/gateways/PaymentGatewayManager';
import { WebhookService } from '@/domains/webhooks/WebhookService';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '../../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../../audit/AuditModule';

export class InvoiceService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly paymentGatewayManager: PaymentGatewayManager,
    private readonly webhookService: WebhookService,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async create(input: CreateInvoiceInput, userId?: string): Promise<Invoice> {
    const customer = await this.customerRepository.getById(input.businessId, input.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', input.customerId);
    }

    const invoice = await this.invoiceRepository.create(input);

    this.webhookService.emit(invoice.businessId, 'invoice.created', {
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      customerId: invoice.customerId,
      status: invoice.status,
    });

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'Invoice',
        entityId: invoice.id,
        businessId: invoice.businessId,
        action: 'create',
        userId,
      });
    }

    return invoice;
  }

  async list(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    return this.invoiceRepository.listByBusiness(businessId, page, limit, exclusiveStartKey);
  }

  async getById(businessId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.getById(businessId, id);
    if (!invoice) {
      throw new NotFoundError('Invoice', id);
    }
    return invoice;
  }

  /**
   * Generate a payment link for an invoice. Uses PaymentGatewayManager to select
   * gateway by currency and create payment intent.
   */
  async generatePaymentLink(businessId: string, invoiceId: string): Promise<{ paymentUrl: string }> {
    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    if (invoice.status === 'paid') {
      throw new ValidationError('Cannot generate payment link for paid invoice');
    }

    if (invoice.status === 'cancelled') {
      throw new ValidationError('Cannot generate payment link for cancelled invoice');
    }

    const response = await this.paymentGatewayManager.createPaymentIntent({
      businessId: invoice.businessId,
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      customerId: invoice.customerId,
      metadata: {
        invoiceId: invoice.id,
        businessId: invoice.businessId,
      },
    });

    if (!response.success || !response.paymentUrl) {
      throw new ValidationError(
        response.error ?? 'Failed to create payment link',
        { gatewayTransactionId: response.gatewayTransactionId }
      );
    }

    return { paymentUrl: response.paymentUrl };
  }

  /**
   * Mark invoice as paid (e.g. from payment webhook). Emits invoice.paid webhook.
   */
  async markPaidFromWebhook(businessId: string, invoiceId: string): Promise<Invoice | null> {
    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) return null;
    if (invoice.status === 'paid') return invoice;

    const updated = await this.invoiceRepository.updateStatus(businessId, invoiceId, 'paid');
    if (updated) {
      this.webhookService.emit(businessId, 'invoice.paid', {
        invoiceId: updated.id,
        amount: updated.amount,
        currency: updated.currency,
        customerId: updated.customerId,
      });
    }
    return updated;
  }
}
