import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { InvoiceShareRepository } from '../repositories/InvoiceShareRepository';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { InvoiceService } from './InvoiceService';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';
import type { Invoice, InvoiceItem } from '../models/Invoice';

const TTL_DAYS = 7;

export interface PublicInvoicePayResponse {
  invoice: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    items: InvoiceItem[];
    dueDate: string;
    createdAt: string;
  };
  business: { name: string };
  customer: { name: string };
  paymentUrl?: string;
}

@Injectable()
export class InvoiceShareService {
  constructor(
    private readonly invoiceShareRepository: InvoiceShareRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly businessRepository: BusinessRepository,
    private readonly invoiceService: InvoiceService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate a wa.me share link for sending an invoice to a customer via WhatsApp.
   * Creates a share token and uses the pay URL in the pre-filled message.
   */
  async generateWhatsAppShareLink(
    businessId: string,
    invoiceId: string
  ): Promise<{ url: string }> {
    const { payUrl } = await this.generatePublicToken(invoiceId, businessId);

    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) throw new NotFoundError('Invoice', invoiceId);

    const customer = await this.customerRepository.getById(businessId, invoice.customerId);
    if (!customer) throw new NotFoundError('Customer', invoice.customerId);

    const phone = customer.phone?.trim();
    if (!phone) {
      throw new ValidationError(
        'Customer has no phone number. Add a phone number to share invoices via WhatsApp.'
      );
    }

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      throw new ValidationError(
        'Invalid phone number format. Use E.164 format (e.g. +2348012345678).'
      );
    }

    const business = await this.businessRepository.getById(businessId);
    const businessName = business?.name ?? 'Your Business';
    const customerName = customer.name ?? 'there';

    const text = [
      `Hello ${customerName},`,
      '',
      `${businessName} has sent you invoice #${invoice.id.slice(0, 8)} for ${invoice.amount} ${invoice.currency}.`,
      '',
      `View and pay here: ${payUrl}`,
      '',
      '— Sent via Kaba',
    ].join('\n');

    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${normalizedPhone.replace(/^\+/, '')}?text=${encodedText}`;

    return { url };
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('0') && digits.length >= 11) return `+234${digits.slice(1)}`;
    if (digits.length === 10 && digits[0] >= '2' && digits[0] <= '9') return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (!phone.startsWith('+')) return `+${digits}`;
    return phone;
  }

  /**
   * Generate a public share token for an invoice. Token expires in 7 days.
   * Returns token and payUrl for the frontend payment portal.
   */
  async generatePublicToken(
    invoiceId: string,
    businessId: string
  ): Promise<{ token: string; payUrl: string }> {
    const invoice = await this.invoiceRepository.getById(businessId, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.invoiceShareRepository.create(
      token,
      invoiceId,
      businessId,
      expiresAt
    );

    const baseUrl =
      this.configService.get<string>('oauth.frontendUrl') ??
      process.env.FRONTEND_URL ??
      process.env.APP_URL ??
      'http://localhost:3000';
    const payUrl = `${baseUrl.replace(/\/$/, '')}/pay/${token}`;

    return { token, payUrl };
  }

  /**
   * Get invoice details by public token for the payment portal.
   * Returns invoice, business, customer info and paymentUrl for unpaid invoices.
   */
  async getInvoiceByToken(token: string): Promise<PublicInvoicePayResponse | null> {
    const record = await this.invoiceShareRepository.getByToken(token);
    if (!record) return null;

    if (new Date(record.expiresAt) < new Date()) return null;

    const invoice = await this.invoiceRepository.getById(
      record.businessId,
      record.invoiceId
    );
    if (!invoice || invoice.deletedAt) return null;

    const [business, customer] = await Promise.all([
      this.businessRepository.getById(record.businessId),
      this.customerRepository.getById(record.businessId, invoice.customerId),
    ]);

    let paymentUrl: string | undefined;
    if (invoice.status !== 'paid' && invoice.status !== 'cancelled') {
      try {
        const link = await this.invoiceService.generatePaymentLink(
          record.businessId,
          record.invoiceId
        );
        paymentUrl = link.paymentUrl;
      } catch {
        // Payment link generation may fail (e.g. gateway not configured)
        paymentUrl = undefined;
      }
    }

    return {
      invoice: this.toPublicInvoice(invoice),
      business: { name: business?.name ?? 'Business' },
      customer: { name: customer?.name ?? 'Customer' },
      ...(paymentUrl && { paymentUrl }),
    };
  }

  private toPublicInvoice(invoice: Invoice): PublicInvoicePayResponse['invoice'] {
    return {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      items: invoice.items,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
    };
  }
}
