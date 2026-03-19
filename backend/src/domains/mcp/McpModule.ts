import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DYNAMODB_DOC_CLIENT, DYNAMODB_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { InventoryModule } from '@/domains/inventory/InventoryModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { TrustModule } from '@/domains/trust/TrustModule';
import { SupplierModule } from '@/domains/suppliers/SupplierModule';
import { AIModule } from '@/nest/modules/ai/ai.module';
import { ReportModule } from '@/domains/reports/ReportModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AuditModule } from '@/domains/audit/AuditModule';
import { ReceiptModule } from '@/domains/receipts/ReceiptModule';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { AuditRepository } from '@/domains/audit/repositories/AuditRepository';
import { AdminMetricsService } from '@/domains/admin/AdminMetricsService';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { ReceiptStorageService } from '@/domains/receipts/ReceiptStorageService';
import { AICostTracker } from './services/AICostTracker';
import type { IMcpTool } from './interfaces/IMcpTool';
import { AgentSessionStore } from './AgentSessionStore';
import { ToolRegistry } from './ToolRegistry';
import { AgentOrchestrator } from './AgentOrchestrator';
import { McpController } from './McpController';
import { MCP_TOOLS } from './mcp.tokens';
import {
  LookupMyInvoicesTool,
  GetInvoiceDetailTool,
  GetPaymentLinkTool,
  GetPaymentStatusTool,
} from './tools/customer';
import {
  ListBusinessesTool,
  GetBusinessHealthTool,
  GetPlatformMetricsTool,
  SetBusinessTierTool,
  GetUsageSummaryTool,
  QueryAuditLogsTool,
} from './tools/admin';
import {
  AddDebtTool,
  UpdateInventoryTool,
  SendDebtReminderTool,
  GetTaxEstimateTool,
  GetDailySummaryTool,
  AnalyzeTrendsTool,
  SendBulkInvoicesTool,
  GenerateTaxReportTool,
  ReconcilePaymentsTool,
  PredictCashShortageTool,
} from './tools/business';

const CUSTOMER_TOOL_PROVIDERS = [
  LookupMyInvoicesTool,
  GetInvoiceDetailTool,
  GetPaymentLinkTool,
  GetPaymentStatusTool,
];

const ADMIN_TOOL_PROVIDERS = [
  ListBusinessesTool,
  GetBusinessHealthTool,
  GetPlatformMetricsTool,
  SetBusinessTierTool,
  GetUsageSummaryTool,
  QueryAuditLogsTool,
];

const BUSINESS_TOOL_PROVIDERS = [
  AddDebtTool,
  UpdateInventoryTool,
  SendDebtReminderTool,
  GetTaxEstimateTool,
  GetDailySummaryTool,
  AnalyzeTrendsTool,
  SendBulkInvoicesTool,
  GenerateTaxReportTool,
  ReconcilePaymentsTool,
  PredictCashShortageTool,
];

@Module({
  imports: [
    LedgerModule,
    InvoiceModule,
    InventoryModule,
    DebtModule,
    TrustModule,
    SupplierModule,
    AIModule,
    ReportModule,
    BusinessModule,
    AuditModule,
    ReceiptModule,
  ],
  controllers: [McpController],
  providers: [
    AgentSessionStore,
    ToolRegistry,
    AgentOrchestrator,
    {
      provide: CustomerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'Kaba-Invoices-dev';
        return new CustomerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: AuditRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.auditLogsTable') ?? 'Kaba-AuditLogs-dev';
        const retentionDays = config.get<number>('compliance.auditRetentionDays') ?? 2555;
        return new AuditRepository(docClient, tableName, retentionDays);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: AICostTracker,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.usersTable') ?? 'Kaba-UsersService-dev-users';
        return new AICostTracker(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: AdminMetricsService,
      useFactory: (
        ddbClient: DynamoDBClient,
        docClient: DynamoDBDocumentClient,
        config: ConfigService,
        ledgerRepo: LedgerRepository,
        receiptStorage: ReceiptStorageService,
      ) => new AdminMetricsService(ddbClient, docClient, config, ledgerRepo, receiptStorage),
      inject: [DYNAMODB_CLIENT, DYNAMODB_DOC_CLIENT, ConfigService, LedgerRepository, ReceiptStorageService],
    },
    ...CUSTOMER_TOOL_PROVIDERS,
    ...ADMIN_TOOL_PROVIDERS,
    ...BUSINESS_TOOL_PROVIDERS,
    {
      provide: MCP_TOOLS,
      useFactory: (
        lookupMyInvoices: LookupMyInvoicesTool,
        getInvoiceDetail: GetInvoiceDetailTool,
        getPaymentLink: GetPaymentLinkTool,
        getPaymentStatus: GetPaymentStatusTool,
        listBusinesses: ListBusinessesTool,
        getBusinessHealth: GetBusinessHealthTool,
        getPlatformMetrics: GetPlatformMetricsTool,
        setBusinessTier: SetBusinessTierTool,
        getUsageSummary: GetUsageSummaryTool,
        queryAuditLogs: QueryAuditLogsTool,
        addDebt: AddDebtTool,
        updateInventory: UpdateInventoryTool,
        sendDebtReminder: SendDebtReminderTool,
        getTaxEstimate: GetTaxEstimateTool,
        getDailySummary: GetDailySummaryTool,
        analyzeTrends: AnalyzeTrendsTool,
        sendBulkInvoices: SendBulkInvoicesTool,
        generateTaxReport: GenerateTaxReportTool,
        reconcilePayments: ReconcilePaymentsTool,
        predictCashShortage: PredictCashShortageTool,
      ): IMcpTool[] => [
        lookupMyInvoices,
        getInvoiceDetail,
        getPaymentLink,
        getPaymentStatus,
        listBusinesses,
        getBusinessHealth,
        getPlatformMetrics,
        setBusinessTier,
        getUsageSummary,
        queryAuditLogs,
        addDebt,
        updateInventory,
        sendDebtReminder,
        getTaxEstimate,
        getDailySummary,
        analyzeTrends,
        sendBulkInvoices,
        generateTaxReport,
        reconcilePayments,
        predictCashShortage,
      ],
      inject: [
        LookupMyInvoicesTool,
        GetInvoiceDetailTool,
        GetPaymentLinkTool,
        GetPaymentStatusTool,
        ListBusinessesTool,
        GetBusinessHealthTool,
        GetPlatformMetricsTool,
        SetBusinessTierTool,
        GetUsageSummaryTool,
        QueryAuditLogsTool,
        AddDebtTool,
        UpdateInventoryTool,
        SendDebtReminderTool,
        GetTaxEstimateTool,
        GetDailySummaryTool,
        AnalyzeTrendsTool,
        SendBulkInvoicesTool,
        GenerateTaxReportTool,
        ReconcilePaymentsTool,
        PredictCashShortageTool,
      ],
    },
  ],
  exports: [AgentOrchestrator],
})
export class McpModule {}
