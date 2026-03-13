import { Injectable, Optional } from '@nestjs/common';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { InvoiceShareService } from '@/domains/invoicing/services/InvoiceShareService';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { DebtService } from '@/domains/debts/services/DebtService';
import { ProductService } from '@/domains/inventory/services/ProductService';
import { BusinessTrustScoreService } from '@/domains/trust/BusinessTrustScoreService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { AdminMetricsService } from '@/domains/admin/AdminMetricsService';
import { AuditRepository } from '@/domains/audit/repositories/AuditRepository';
import { ReportService } from '@/domains/reports/ReportService';
import { SupplierService } from '@/domains/suppliers/services/SupplierService';
import { SupplierPaymentService } from '@/domains/suppliers/services/SupplierPaymentService';
import { FeatureService } from '@/domains/features/FeatureService';
import type { Tier } from '@/domains/features/feature.types';

export interface ToolContext {
  scope: 'business' | 'customer' | 'admin';
  businessId: string;
  userId?: string;
  customerEmail?: string;
  tier: Tier;
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: string;
  requiredTier?: string;
}

function getStartOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

@Injectable()
export class ToolExecutor {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly invoiceService: InvoiceService,
    private readonly shareService: InvoiceShareService,
    private readonly customerRepository: CustomerRepository,
    private readonly debtService: DebtService,
    private readonly productService: ProductService,
    private readonly trustService: BusinessTrustScoreService,
    private readonly businessRepository: BusinessRepository,
    private readonly reportService: ReportService,
    private readonly supplierService: SupplierService,
    private readonly supplierPaymentService: SupplierPaymentService,
    private readonly featureService: FeatureService,
    @Optional() private readonly adminMetricsService?: AdminMetricsService,
    @Optional() private readonly auditRepository?: AuditRepository,
  ) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const { businessId, userId, customerEmail, tier } = context;

    const customerScopeTools = new Set([
      'lookup_my_invoices', 'get_invoice_detail', 'get_payment_link', 'get_payment_status',
    ]);
    const adminScopeTools = new Set([
      'list_businesses', 'get_business_health', 'get_platform_metrics',
      'set_business_tier', 'get_usage_summary', 'query_audit_logs',
    ]);

    if (!customerScopeTools.has(toolName) && !adminScopeTools.has(toolName)) {
      if (!this.featureService.isEnabled('mcp_agent_basic', tier)) {
        return {
          toolName,
          result: null,
          error: 'upgrade_required',
          requiredTier: 'starter',
        };
      }

      const advancedTools = new Set([
        'record_sale', 'record_expense', 'create_invoice', 'send_invoice_payment_link',
        'list_suppliers', 'pay_supplier', 'get_loan_readiness', 'get_cash_flow_forecast',
      ]);

      if (advancedTools.has(toolName) && !this.featureService.isEnabled('mcp_agent_advanced', tier)) {
        return {
          toolName,
          result: null,
          error: 'upgrade_required',
          requiredTier: 'pro',
        };
      }
    }

    try {
      const result = await this.dispatch(toolName, args, businessId, userId, customerEmail);
      return { toolName, result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { toolName, result: null, error: message };
    }
  }

  private async dispatch(
    toolName: string,
    args: Record<string, unknown>,
    businessId: string,
    userId?: string,
    customerEmail?: string,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_balance':
        return this.ledgerService.getBalance(businessId);

      case 'list_recent_transactions':
        return this.ledgerService.listWithCursor(businessId, 10);

      case 'record_sale':
        return this.ledgerService.createEntry(
          {
            businessId,
            type: 'sale',
            amount: args['amount'] as number,
            description: args['description'] as string,
            currency: (args['currency'] as string) ?? 'XOF',
            category: (args['category'] as string) ?? 'sales',
            date: getToday(),
          },
          userId,
        );

      case 'record_expense':
        return this.ledgerService.createEntry(
          {
            businessId,
            type: 'expense',
            amount: args['amount'] as number,
            description: args['description'] as string,
            currency: (args['currency'] as string) ?? 'XOF',
            category: (args['category'] as string) ?? 'general',
            date: getToday(),
          },
          userId,
        );

      case 'get_profit_loss':
        return this.reportService.getPL(
          businessId,
          (args['fromDate'] as string) ?? getStartOfMonth(),
          (args['toDate'] as string) ?? getToday(),
        );

      case 'list_unpaid_invoices':
        return this.invoiceService.listUnpaid(businessId);

      case 'create_invoice': {
        const rawItems = args['items'] as Array<{ description: string; quantity: number; unitPrice: number; amount?: number }>;
        const invoiceItems = rawItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount ?? item.quantity * item.unitPrice,
        }));
        const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
        return this.invoiceService.create(
          {
            businessId,
            customerId: args['customerId'] as string,
            items: invoiceItems,
            amount: totalAmount,
            currency: args['currency'] as string,
            dueDate: args['dueDate'] as string,
          },
          userId,
        );
      }

      case 'send_invoice_payment_link':
        return this.shareService.generatePublicToken(args['invoiceId'] as string, businessId);

      case 'list_debts':
        return this.debtService.list(businessId);

      case 'check_stock':
        return this.productService.list(businessId);

      case 'get_trust_score':
        return this.trustService.calculate(businessId);

      case 'list_suppliers':
        return this.supplierService.list(businessId);

      case 'pay_supplier':
        return this.supplierPaymentService.paySupplier(
          businessId,
          args['supplierId'] as string,
          args['amount'] as number,
          args['currency'] as string,
          args['description'] as string | undefined,
        );

      case 'get_loan_readiness':
        return { message: 'Loan readiness assessment coming soon.' };

      case 'get_cash_flow_forecast':
        return { message: 'Cash flow forecast coming soon.' };

      case 'lookup_my_invoices': {
        const fromDate = args['fromDate'] as string | undefined;
        const toDate = args['toDate'] as string | undefined;
        const result = await this.invoiceService.list(businessId, 1, 20, undefined, fromDate, toDate);
        if (!customerEmail) return result.items.map(this.toPublicInvoice);
        const customer = await this.customerRepository.findByEmail(businessId, customerEmail);
        const items = customer
          ? result.items.filter((inv) => inv.customerId === customer.id)
          : [];
        return items.map(this.toPublicInvoice);
      }

      case 'get_invoice_detail': {
        const invoice = await this.invoiceService.getById(businessId, args['invoiceId'] as string);
        if (customerEmail) {
          const customer = await this.customerRepository.findByEmail(businessId, customerEmail);
          if (!customer || invoice.customerId !== customer.id) {
            throw new Error('Invoice not found');
          }
        }
        return {
          id: invoice.id,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          status: invoice.status,
          items: invoice.items,
          createdAt: invoice.createdAt,
        };
      }

      case 'get_payment_link': {
        const invoice = await this.invoiceService.getById(businessId, args['invoiceId'] as string);
        if (customerEmail) {
          const customer = await this.customerRepository.findByEmail(businessId, customerEmail);
          if (!customer || invoice.customerId !== customer.id) {
            throw new Error('Invoice not found');
          }
        }
        const { payUrl } = await this.shareService.generatePublicToken(args['invoiceId'] as string, businessId);
        return { payUrl, expiresIn: '7 days' };
      }

      case 'get_payment_status': {
        const invoice = await this.invoiceService.getById(businessId, args['invoiceId'] as string);
        if (customerEmail) {
          const customer = await this.customerRepository.findByEmail(businessId, customerEmail);
          if (!customer || invoice.customerId !== customer.id) {
            throw new Error('Invoice not found');
          }
        }
        return {
          invoiceId: invoice.id,
          status: invoice.status,
          amount: invoice.amount,
          currency: invoice.currency,
          paidAt: (invoice as unknown as Record<string, unknown>)['paidAt'] ?? null,
        };
      }

      case 'list_businesses': {
        const limit = Math.min(Number(args['limit'] ?? 20), 50);
        if (!this.adminMetricsService) return { items: [] };
        const { items } = await this.adminMetricsService.listBusinesses(limit);
        const tierFilter = args['tier'] as string | undefined;
        const countryFilter = args['countryCode'] as string | undefined;
        const filtered = items
          .filter((b) => !tierFilter || b.tier === tierFilter)
          .filter((b) => !countryFilter || b.countryCode === countryFilter);
        return filtered.map((b) => ({
          businessId: b.id,
          name: b.name,
          tier: b.tier,
          countryCode: b.countryCode,
          currency: b.currency,
          createdAt: b.createdAt,
        }));
      }

      case 'get_business_health': {
        const targetId = args['businessId'] as string;
        const result = await this.trustService.calculate(targetId);
        return {
          businessId: result.businessId,
          trustScore: result.trustScore,
          recommendation: result.recommendation,
          signals: result.breakdown,
        };
      }

      case 'get_platform_metrics': {
        if (!this.adminMetricsService) return { message: 'Admin metrics service not available' };
        return this.adminMetricsService.getSummary();
      }

      case 'set_business_tier': {
        const targetId = args['businessId'] as string;
        const newTier = args['tier'] as string;
        const validTiers = ['free', 'starter', 'pro', 'enterprise'];
        if (!validTiers.includes(newTier)) {
          throw new Error(`Invalid tier: ${newTier}. Must be one of ${validTiers.join(', ')}`);
        }
        await this.businessRepository.updateTier(targetId, newTier as 'free' | 'starter' | 'pro' | 'enterprise');
        return { businessId: targetId, tier: newTier, updatedAt: new Date().toISOString() };
      }

      case 'get_usage_summary': {
        const limit = Math.min(Number(args['limit'] ?? 20), 50);
        if (!this.adminMetricsService) return { items: [] };
        const { items } = await this.adminMetricsService.listBusinesses(limit);
        return {
          businesses: items.map((b) => ({
            businessId: b.id,
            name: b.name,
            tier: b.tier,
            countryCode: b.countryCode,
          })),
          total: items.length,
          note: 'Usage tracking per business is available in the admin dashboard.',
        };
      }

      case 'query_audit_logs': {
        const targetId = args['businessId'] as string;
        const limit = Math.min(Number(args['limit'] ?? 20), 100);
        const fromDate = args['fromDate'] as string | undefined;
        if (!this.auditRepository) return { items: [] };
        const { items } = await this.auditRepository.queryByBusiness(
          targetId,
          fromDate,
          undefined,
          limit,
        );
        return items;
      }

      default:
        return { message: `Unknown tool: ${toolName}` };
    }
  }

  private toPublicInvoice(invoice: { id: string; amount: number; currency: string; dueDate: string; status: string; items: unknown[] }) {
    return {
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      status: invoice.status,
    };
  }
}
