import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { WebhookModule } from '@/domains/webhooks/WebhookModule';
import { TaxModule } from '@/nest/modules/tax/tax.module';
import { InvoiceRepository } from './repositories/InvoiceRepository';
import { CustomerRepository } from './repositories/CustomerRepository';
import { InvoiceService } from './services/InvoiceService';
import { CustomerService } from './services/CustomerService';
import { InvoiceController } from './InvoiceController';
import { CustomerController } from './CustomerController';

@Module({
  imports: [AuditModule, AccessModule, BusinessModule, WebhookModule, TaxModule],
  controllers: [InvoiceController, CustomerController],
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
    InvoiceService,
    CustomerService,
  ],
  exports: [InvoiceService, CustomerService],
})
export class InvoiceModule {}
