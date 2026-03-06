import { Injectable, Inject, Optional } from '@nestjs/common';
import { InvoiceRepository, ListByBusinessResult } from '../repositories/InvoiceRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { Invoice, CreateInvoiceInput, InvoiceStatus, UpdateInvoiceInput } from '../models/Invoice';
import { PaymentGatewayManager } from '@/domains/payments/gateways/PaymentGatewayManager';
import { WebhookService } from '@/domains/webhooks/WebhookService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { AccessService } from '@/domains/access/AccessService';
import { EmailService } from '@/domains/verification/EmailService';
import { InvoicePdfService } from './InvoicePdfService';
import { ReceiptStorageService } from '@/domains/receipts/ReceiptStorageService';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '../../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../../audit/AuditModule';
import type { IMECeFProvider } from '@/domains/tax/interfaces/IMECeFProvider';
import type { IFNEProvider } from '@/domains/tax/interfaces/IFNEProvider';
import type { IWhatsAppProvider } from '@/domains/notifications/IWhatsAppProvider';
import { MECEF_PROVIDER, FNE_PROVIDER } from '@/nest/modules/tax/tax.tokens';
import { WHATSAPP_PROVIDER } from '@/domains/notifications/notification.tokens';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly paymentGatewayManager: PaymentGatewayManager,
    private readonly webhookService: WebhookService,
    private readonly businessRepository: BusinessRepository,
    private readonly accessService: AccessService,
    private readonly emailService: EmailService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly receiptStorageService: ReceiptStorageService,
    @Optional() private readonly ledgerService?: LedgerService,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
    @Optional() @Inject(MECEF_PROVIDER) private readonly mecefProvider?: IMECeFProvider,
    @Optional() @Inject(FNE_PROVIDER) private readonly fneProvider?: IFNEProvider,
    @Optional() @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider?: IWhatsAppProvider,
  ) {}

  async create(
    input: CreateInvoiceInput,
    userId?: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<Invoice> {
    const totalAmount = input.items.reduce((s, i) => s + i.amount, 0);
    if (totalAmount <= 0 || input.items.length === 0) {
      throw new ValidationError('Invoice must have at least one line item with a positive amount');
    }

    const customer = await this.customerRepository.getById(input.businessId, input.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', input.customerId);
    }

    const business = await this.businessRepository.getById(input.businessId);

    // Sales role creates invoices as pending_approval unless explicitly overridden
    let status = input.status ?? 'draft';
    if (userId && !input.status) {
      const role = await this.accessService.getUserRole(input.businessId, userId);
      if (role === 'sales') {
        status = 'pending_approval';
      }
    }

    const invoice = await this.invoiceRepository.create({
      ...input,
      status,
      earlyPaymentDiscountPercent: input.earlyPaymentDiscountPercent,
      earlyPaymentDiscountDays: input.earlyPaymentDiscountDays,
    });

    // Only emit webhook and run MECeF for non-pending invoices
    if (status !== 'pending_approval') {
      this.webhookService.emit(invoice.businessId, 'invoice.created', {
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        customerId: invoice.customerId,
        status: invoice.status,
      });

      // Fiscal certification: Benin (e-MECeF) or Côte d'Ivoire (FNE)
      if (business?.countryCode === 'BJ' && this.mecefProvider?.getSupportedCountries().includes('BJ')) {
        this.registerWithMECeF(invoice, business).catch((err) => {
          console.error('[InvoiceService] MECeF registration failed:', err);
        });
      } else if (
        business?.countryCode === 'CI' &&
        this.fneProvider?.getSupportedCountries().includes('CI')
      ) {
        this.registerWithFNE(invoice, business).catch((err) => {
          console.error('[InvoiceService] FNE registration failed:', err);
        });
      }
    }

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'Invoice',
        entityId: invoice.id,
        businessId: invoice.businessId,
        action: 'create',
        userId,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
      }).catch(() => {});
    }

    return invoice;
  }

  async update(
    businessId: string,
    id: string,
    input: UpdateInvoiceInput,
    userId?: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<Invoice> {
    const existing = await this.invoiceRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Invoice', id);
    }
    if (existing.status !== 'draft' && existing.status !== 'pending_approval') {
      throw new ValidationError('Only draft or pending-approval invoices can be edited');
    }

    if (input.items != null) {
      const totalAmount = input.items.reduce((s, i) => s + i.amount, 0);
      if (totalAmount <= 0 || input.items.length === 0) {
        throw new ValidationError('Invoice must have at least one line item with a positive amount');
      }
    }

    if (input.customerId != null) {
      const customer = await this.customerRepository.getById(businessId, input.customerId);
      if (!customer) {
        throw new NotFoundError('Customer', input.customerId);
      }
    }

    const merged: UpdateInvoiceInput = {
      customerId: input.customerId ?? existing.customerId,
      amount: input.amount ?? (input.items ? input.items.reduce((s, i) => s + i.amount, 0) : existing.amount),
      currency: input.currency ?? existing.currency,
      items: input.items ?? existing.items,
      dueDate: input.dueDate ?? existing.dueDate,
      earlyPaymentDiscountPercent: input.earlyPaymentDiscountPercent ?? existing.earlyPaymentDiscountPercent,
      earlyPaymentDiscountDays: input.earlyPaymentDiscountDays ?? existing.earlyPaymentDiscountDays,
    };

    const updated = await this.invoiceRepository.update(businessId, id, merged);
    if (!updated) {
      // Re-fetch to distinguish not-found from non-editable status (race condition)
      const current = await this.invoiceRepository.getById(businessId, id);
      if (!current) {
        throw new NotFoundError('Invoice', id);
      }
      throw new ValidationError(`Invoice cannot be edited in status '${current.status}'`);
    }

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'Invoice',
        entityId: updated.id,
        businessId: updated.businessId,
        action: 'update',
        userId,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
      }).catch(() => {});
    }

    return updated;
  }

  /** Background MECeF registration and auto-confirm within 120s window. */
  private async registerWithMECeF(
    invoice: Invoice,
    business: { taxId?: string; countryCode?: string }
  ): Promise<void> {
    if (!this.mecefProvider) return;

    const ifu = business.taxId ?? invoice.businessId;
    const vatRate = 0.18;
    const montant_ht = Math.round((invoice.amount / (1 + vatRate)) * 100) / 100;
    const montant_tva = Math.round((invoice.amount - montant_ht) * 100) / 100;

    const registration = await this.mecefProvider.registerInvoice({
      nim: `APP-${invoice.businessId.slice(0, 8)}`,
      ifu,
      client_ifu: invoice.customerId,
      reference: invoice.id,
      montant_ht,
      montant_tva,
      montant_ttc: invoice.amount,
      type_facture: 'FV',
      date: invoice.createdAt.slice(0, 10),
      items: invoice.items.map((item) => {
        const ht = Math.round((item.amount / (1 + vatRate)) * 100) / 100;
        const tva = Math.round((item.amount - ht) * 100) / 100;
        return {
          nom: item.description,
          quantite: item.quantity,
          prix_unitaire_ht: Math.round((item.unitPrice / (1 + vatRate)) * 100) / 100,
          montant_ht: ht,
          montant_tva: tva,
          montant_ttc: item.amount,
        };
      }),
    });

    await this.invoiceRepository.updateMECeF(invoice.businessId, invoice.id, 'pending', {
      mecefToken: registration.token,
    });

    // Auto-confirm after a brief delay to let DGI process
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const confirmation = await this.mecefProvider.confirmInvoice(registration.token, 'confirm');

    if (confirmation) {
      await this.invoiceRepository.updateMECeF(invoice.businessId, invoice.id, 'confirmed', {
        mecefQrCode: confirmation.qr_code,
        mecefSerialNumber: confirmation.nim_facture,
      });
    } else {
      await this.invoiceRepository.updateMECeF(invoice.businessId, invoice.id, 'rejected');
    }
  }

  /** Background FNE registration for Côte d'Ivoire businesses. */
  private async registerWithFNE(
    invoice: Invoice,
    business: { taxId?: string; countryCode?: string }
  ): Promise<void> {
    if (!this.fneProvider) return;

    const result = await this.fneProvider.registerInvoice(business.countryCode ?? 'CI', {
      businessId: invoice.businessId,
      invoiceId: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      customerId: invoice.customerId,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    });

    if (result) {
      await this.invoiceRepository.updateMECeF(invoice.businessId, invoice.id, 'confirmed', {
        mecefQrCode: result.qrCodeData,
        mecefSerialNumber: result.serialNumber,
      });
    }
  }

  /**
   * Approve a pending_approval invoice. Only callable by accountant/owner.
   * Emits invoice.created webhook after approval.
   */
  async approveInvoice(
    businessId: string,
    invoiceId: string,
    approverId: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<Invoice> {
    const role = await this.accessService.getUserRole(businessId, approverId);
    if (!role || role === 'sales' || role === 'viewer') {
      throw new ValidationError('Only accountants and owners can approve invoices');
    }

    const approved = await this.invoiceRepository.approve(businessId, invoiceId);
    if (!approved) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    this.webhookService.emit(businessId, 'invoice.created', {
      invoiceId: approved.id,
      amount: approved.amount,
      currency: approved.currency,
      customerId: approved.customerId,
      status: approved.status,
    });

    if (this.auditLogger) {
      this.auditLogger.log({
        entityType: 'Invoice',
        entityId: invoiceId,
        businessId,
        action: 'approve',
        userId: approverId,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
      }).catch(() => {});
    }

    return approved;
  }

  async listPendingApproval(
    businessId: string,
    limit = 20,
    exclusiveStartKey?: Record<string, unknown>
  ) {
    return this.invoiceRepository.listByBusinessAndStatus(
      businessId,
      'pending_approval',
      limit,
      exclusiveStartKey
    );
  }

  async listByStatus(
    businessId: string,
    status: InvoiceStatus,
    limit = 20,
    exclusiveStartKey?: Record<string, unknown>
  ) {
    return this.invoiceRepository.listByBusinessAndStatus(
      businessId,
      status,
      limit,
      exclusiveStartKey
    );
  }

  async count(businessId: string): Promise<number> {
    return this.invoiceRepository.countByBusiness(businessId);
  }

  async list(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    exclusiveStartKey?: Record<string, unknown>
  ): Promise<ListByBusinessResult> {
    return this.invoiceRepository.listByBusiness(businessId, page, limit, exclusiveStartKey);
  }

  /** List all unpaid invoices (draft, sent, overdue) for dashboard/reporting. */
  async listUnpaid(businessId: string): Promise<Invoice[]> {
    const all = await this.invoiceRepository.listAllByBusiness(businessId);
    return all.filter(
      (inv) =>
        !inv.deletedAt &&
        inv.status !== 'paid' &&
        inv.status !== 'cancelled',
    );
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
  async generatePaymentLink(businessId: string, invoiceId: string, userId?: string): Promise<{ paymentUrl: string }> {
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

    const business = await this.businessRepository.getById(invoice.businessId);

    let amount = invoice.amount;
    if (
      invoice.earlyPaymentDiscountPercent != null &&
      invoice.earlyPaymentDiscountPercent > 0 &&
      invoice.earlyPaymentDiscountDays != null &&
      invoice.earlyPaymentDiscountDays > 0
    ) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const createdAt = new Date(invoice.createdAt);
      createdAt.setHours(0, 0, 0, 0);
      const daysSinceCreation = Math.ceil(
        (today.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysSinceCreation <= invoice.earlyPaymentDiscountDays) {
        amount =
          Math.round(
            invoice.amount * (1 - invoice.earlyPaymentDiscountPercent / 100) * 100
          ) / 100;
      }
    }

    const response = await this.paymentGatewayManager.createPaymentIntent({
      businessId: invoice.businessId,
      invoiceId: invoice.id,
      amount,
      currency: invoice.currency,
      countryCode: business?.countryCode,
      customerId: invoice.customerId,
      metadata: {
        invoiceId: invoice.id,
        businessId: invoice.businessId,
      },
    });

    if (!response.success || !response.paymentUrl) {
      if (this.auditLogger) {
        this.auditLogger.log({
          entityType: 'payment',
          entityId: invoice.id,
          businessId: invoice.businessId,
          action: 'payment.failed',
          userId: userId ?? 'system',
          metadata: {
            amount,
            currency: invoice.currency,
            error: response.error ?? 'Failed to create payment link',
          },
        }).catch(() => {});
      }
      throw new ValidationError(
        response.error ?? 'Failed to create payment link',
        { gatewayTransactionId: response.gatewayTransactionId }
      );
    }

    if (this.auditLogger) {
      this.auditLogger.log({
        entityType: 'payment',
        entityId: invoice.id,
        businessId: invoice.businessId,
        action: 'payment.initiated',
        userId: userId ?? 'system',
        metadata: {
          amount,
          currency: invoice.currency,
          gateway: response.gatewayTransactionId ? 'gateway' : 'unknown',
          gatewayTransactionId: response.gatewayTransactionId,
        },
      }).catch(() => {});
    }

    return { paymentUrl: response.paymentUrl };
  }

  /**
   * Mark invoice as paid (e.g. from payment webhook). Emits invoice.paid webhook.
   * Creates a ledger sale entry so paid invoices appear in reports and balance.
   */
  async markPaidFromWebhook(businessId: string, invoiceId: string): Promise<Invoice | null> {
    if (!invoiceId?.trim()) return null;
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
      // Create ledger sale entry so paid invoice appears in reports and balance
      if (this.ledgerService) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          await this.ledgerService.createEntry(
            {
              businessId: updated.businessId,
              type: 'sale',
              amount: updated.amount,
              currency: updated.currency,
              description: `Invoice #${updated.id.slice(0, 8)} paid`,
              category: 'Sales',
              date: today,
              skipLimitCheck: true,
            },
            undefined
          );
        } catch (ledgerErr) {
          console.error('[InvoiceService] Failed to create ledger entry for paid invoice:', ledgerErr);
        }
      }
    }
    return updated;
  }

  /**
   * Send invoice by email with PDF attachment.
   */
  async sendInvoice(
    businessId: string,
    invoiceId: string,
  ): Promise<{ sent: boolean; channel: 'email' }> {
    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const customer = await this.customerRepository.getById(businessId, invoice.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', invoice.customerId);
    }

    if (!customer.email?.trim()) {
      throw new ValidationError('Customer has no email address');
    }

    const business = await this.businessRepository.getById(businessId);
    const businessName = business?.name;

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(
      invoice,
      customer,
      businessName,
    );

    const subject = `Invoice from ${businessName ?? 'Your Business'}`;
    const body = 'Please find your invoice attached.';
    const result = await this.emailService.sendInvoice(
      customer.email,
      subject,
      body,
      pdfBuffer,
      invoiceId,
    );

    if (result.success) {
      await this.invoiceRepository.updateStatus(businessId, invoiceId, 'sent');
    }

    return { sent: result.success, channel: 'email' };
  }

  /**
   * Send invoice PDF to customer via WhatsApp.
   * Requires customer phone (E.164), S3 storage, and WhatsApp provider configured.
   */
  async sendInvoiceViaWhatsApp(
    businessId: string,
    invoiceId: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.whatsappProvider) {
      throw new ValidationError('WhatsApp is not configured. Enable WhatsApp integration to send invoices.');
    }
    if (!this.receiptStorageService.isConfigured()) {
      throw new ValidationError('S3 storage is not configured for invoice PDFs.');
    }

    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const customer = await this.customerRepository.getById(businessId, invoice.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', invoice.customerId);
    }

    const phone = customer.phone?.trim();
    if (!phone) {
      throw new ValidationError('Customer has no phone number. Add a phone number to send invoices via WhatsApp.');
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      throw new ValidationError('Invalid phone number format. Use E.164 format (e.g. +2348012345678).');
    }

    const business = await this.businessRepository.getById(businessId);
    const businessName = business?.name;

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(
      invoice,
      customer,
      businessName,
    );

    const { url } = await this.receiptStorageService.uploadInvoicePdf(businessId, pdfBuffer);

    const caption = `Invoice #${invoice.id} - ${invoice.currency} ${invoice.amount.toLocaleString()}`;

    let result: { success: boolean; messageId?: string };
    if (this.whatsappProvider.sendMedia) {
      result = await this.whatsappProvider.sendMedia(normalizedPhone, url, caption);
    } else {
      result = await this.whatsappProvider.send(normalizedPhone, `${caption}\n${url}`);
    }

    if (result.success) {
      await this.invoiceRepository.updateStatus(businessId, invoiceId, 'sent');
    }

    return { success: result.success, messageId: result.messageId };
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (digits.startsWith('0') && digits.length >= 11) return `+234${digits.slice(1)}`;
    if (!phone.startsWith('+')) return `+${digits}`;
    return phone;
  }
}
