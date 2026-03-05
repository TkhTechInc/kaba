import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { WebhookModule } from '@/domains/webhooks/WebhookModule';
import { VerificationModule } from '@/domains/verification/VerificationModule';
import { TaxModule } from '@/nest/modules/tax/tax.module';
import { ReceiptModule } from '@/domains/receipts/ReceiptModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { InvoiceRepository } from './repositories/InvoiceRepository';
import { InvoiceShareRepository } from './repositories/InvoiceShareRepository';
import { CustomerRepository } from './repositories/CustomerRepository';
import { RecurringInvoiceRepository } from './repositories/RecurringInvoiceRepository';
import { InvoiceService } from './services/InvoiceService';
import { InvoiceShareService } from './services/InvoiceShareService';
import { InvoicePdfService } from './services/InvoicePdfService';
import { CustomerService } from './services/CustomerService';
import { RecurringInvoiceService } from './services/RecurringInvoiceService';
import { InvoiceController } from './InvoiceController';
import { CustomerController } from './CustomerController';
import { RecurringInvoiceController } from './RecurringInvoiceController';

@Module({
  imports: [
    AuditModule,
    AccessModule,
    BusinessModule,
    WebhookModule,
    VerificationModule,
    TaxModule,
    ReceiptModule,
    NotificationsModule,
  ],
  controllers: [RecurringInvoiceController, InvoiceController, CustomerController],
  providers: [
    {
      provide: InvoiceRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'QuickBooks-Invoices-dev';
        return new InvoiceRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: CustomerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'QuickBooks-Invoices-dev';
        return new CustomerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: RecurringInvoiceRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'QuickBooks-Invoices-dev';
        return new RecurringInvoiceRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: InvoiceShareRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new InvoiceShareRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    InvoiceService,
    InvoiceShareService,
    InvoicePdfService,
    CustomerService,
    RecurringInvoiceService,
  ],
  exports: [InvoiceService, CustomerService, RecurringInvoiceService],
})
export class InvoiceModule {}
