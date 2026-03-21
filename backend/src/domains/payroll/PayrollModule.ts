import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { EmployeeRepository } from './repositories/EmployeeRepository';
import { PayRunRepository } from './repositories/PayRunRepository';
import { PayRunLineRepository } from './repositories/PayRunLineRepository';
import { PayrollTaxEngineManager } from './providers/PayrollTaxEngineManager';
import { PayrollService } from './services/PayrollService';
import { PayrollReportService } from './services/PayrollReportService';
import { PayrollController } from './PayrollController';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { PaymentModule } from '@/domains/payments/PaymentModule';
import { AuditModule } from '@/domains/audit/AuditModule';

@Module({
  imports: [
    forwardRef(() => BusinessModule),
    forwardRef(() => LedgerModule),
    forwardRef(() => PaymentModule),
    AuditModule,
  ],
  controllers: [PayrollController],
  providers: [
    {
      provide: EmployeeRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.payrollTable') ?? 'Kaba-Payroll-dev';
        return new EmployeeRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: PayRunRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.payrollTable') ?? 'Kaba-Payroll-dev';
        return new PayRunRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: PayRunLineRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.payrollTable') ?? 'Kaba-Payroll-dev';
        return new PayRunLineRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    PayrollTaxEngineManager,
    PayrollService,
    PayrollReportService,
  ],
  exports: [PayrollService],
})
export class PayrollModule {}
