import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { configuration } from './config/configuration';

/** Custom ConfigModule for Lambda - @nestjs/config ConfigModule breaks when bundled */
@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => new ConfigService(configuration() as Record<string, unknown>),
    },
  ],
  exports: [ConfigService],
})
class AppConfigModule {}
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DynamoDBModule } from './modules/dynamodb/dynamodb.module';
import { FeaturesModule } from '@/domains/features/FeaturesModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './modules/health/health.controller';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { InventoryModule } from '@/domains/inventory/InventoryModule';
import { PaymentModule } from '@/domains/payments/PaymentModule';
import { ReceiptModule } from '@/domains/receipts/ReceiptModule';
import { ReconciliationModule } from '@/domains/reconciliation/ReconciliationModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { AIModule } from './modules/ai/ai.module';
import { TaxModule } from './modules/tax/tax.module';
import { AdminModule } from '@/domains/admin/AdminModule';
import { WebhookModule } from '@/domains/webhooks/WebhookModule';
import { ApiKeyModule } from '@/domains/api-keys/ApiKeyModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { ComplianceModule } from '@/domains/compliance/ComplianceModule';
import { OnboardingModule } from '@/domains/onboarding/OnboardingModule';
import { VoiceModule } from '@/domains/voice/VoiceModule';
import { DashboardModule } from '@/domains/dashboard/DashboardModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { TrustModule } from '@/domains/trust/TrustModule';
import { UssdModule } from '@/domains/ussd/UssdModule';
import { PlanModule } from '@/domains/plans/PlanModule';
import { IdempotencyModule } from '@/domains/idempotency/IdempotencyModule';
import { RegulatoryModule } from '@/domains/regulatory/RegulatoryModule';
import { ChatModule } from '@/domains/chat/ChatModule';
import { StorefrontModule } from '@/domains/storefront/StorefrontModule';
import { SupplierModule } from '@/domains/suppliers/SupplierModule';
import { PayrollModule } from '@/domains/payroll/PayrollModule';
import { MobileModule } from '@/domains/mobile/MobileModule';
import { McpModule } from '@/domains/mcp/McpModule';
import { ApiKeyAuthGuard } from './common/guards/api-key-auth.guard';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    AuthModule,
    DynamoDBModule,
    FeaturesModule,
    BusinessModule,
    PaymentModule,
    LedgerModule,
    NotificationsModule,
    InvoiceModule,
    InventoryModule,
    ReceiptModule,
    ReconciliationModule,
    ReportModule,
    AIModule,
    ChatModule,
    TaxModule,
    AdminModule,
    WebhookModule,
    ApiKeyModule,
    AccessModule,
    ComplianceModule,
    OnboardingModule,
    VoiceModule,
    DashboardModule,
    DebtModule,
    TrustModule,
    UssdModule,
    PlanModule,
    IdempotencyModule,
    RegulatoryModule,
    StorefrontModule,
    SupplierModule,
    PayrollModule,
    MobileModule,
    McpModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApiKeyAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
          const messages = errors.map((e) =>
            e.constraints ? Object.values(e.constraints).join(', ') : `${e.property} invalid`,
          );
          return new BadRequestException({
            message: messages.length === 1 ? messages[0] : messages,
            errors: errors.map((e) => ({
              property: e.property,
              constraints: e.constraints,
            })),
          });
        },
      }),
    },
  ],
})
export class AppModule {}
