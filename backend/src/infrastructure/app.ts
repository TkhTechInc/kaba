#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LedgerServiceStack } from './stacks/LedgerServiceStack';
import { ReceiptsStorageStack } from './stacks/ReceiptsStorageStack';
import { InvoicesServiceStack } from './stacks/InvoicesServiceStack';
import { InventoryServiceStack } from './stacks/InventoryServiceStack';
import { AuditLogsStack } from './stacks/AuditLogsStack';
import { UsersServiceStack } from './stacks/UsersServiceStack';
import { QuickBooksApiStack } from './stacks/QuickBooksApiStack';
import { IdempotencyStack } from './stacks/IdempotencyStack';
import { getEnvironmentConfig, validateEnvironmentConfig } from './config/environments';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const account = app.node.tryGetContext('account') || process.env['CDK_DEFAULT_ACCOUNT'];
const frontendUrlFromContext = app.node.tryGetContext('frontendUrl') as string | undefined;
const googleClientId = app.node.tryGetContext('googleClientId') as string | undefined;
const googleClientSecret = app.node.tryGetContext('googleClientSecret') as string | undefined;
const aiProvider = app.node.tryGetContext('aiProvider') as string | undefined;
const aiModel = app.node.tryGetContext('aiModel') as string | undefined;
const mobileMoneyParserProvider = app.node.tryGetContext('mobileMoneyParserProvider') as 'mock' | 'llm' | undefined;

const envConfig = getEnvironmentConfig(environment);
if (frontendUrlFromContext) {
  envConfig.frontendUrl = frontendUrlFromContext;
}
if (googleClientId) (envConfig as any).googleClientId = googleClientId;
if (googleClientSecret) (envConfig as any).googleClientSecret = googleClientSecret;
if (aiProvider || aiModel || mobileMoneyParserProvider) {
  (envConfig as any).ai = {
    ...(envConfig as any).ai,
    ...(aiProvider && { provider: aiProvider }),
    ...(aiModel && { model: aiModel }),
    ...(mobileMoneyParserProvider && { mobileMoneyParserProvider }),
  };
}
validateEnvironmentConfig(envConfig);

console.log(`🚀 QuickBooks West Africa - Deploying to ${environment}`);
console.log(`📍 Region: ${envConfig.region}`);

const commonProps: cdk.StackProps = {
  env: {
    account,
    region: envConfig.region,
  },
};

const ledgerStack = new LedgerServiceStack(app, `QuickBooks-LedgerService-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Ledger DynamoDB table',
  config: envConfig,
});

const receiptsStack = new ReceiptsStorageStack(app, `QuickBooks-Receipts-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - S3 bucket for receipt storage',
  config: envConfig,
});

const invoicesStack = new InvoicesServiceStack(app, `QuickBooks-InvoicesService-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Invoices DynamoDB table',
  config: envConfig,
});

const inventoryStack = new InventoryServiceStack(app, `QuickBooks-InventoryService-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Inventory DynamoDB table',
  config: envConfig,
});

const auditLogsStack = new AuditLogsStack(app, `QuickBooks-AuditLogs-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Audit logs DynamoDB table',
  config: envConfig,
});

const usersStack = new UsersServiceStack(app, `QuickBooks-UsersService-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Users DynamoDB table',
  config: envConfig,
});

const idempotencyStack = new IdempotencyStack(app, `QuickBooks-Idempotency-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - Idempotency DynamoDB table',
  config: envConfig,
});

const apiStack = new QuickBooksApiStack(app, `QuickBooks-Api-${environment}`, {
  ...commonProps,
  environment,
  description: 'QuickBooks West Africa - API Gateway + Lambda (/api/v1/*)',
  config: envConfig,
  ledgerTable: ledgerStack.ledgerTable,
  invoicesTable: invoicesStack.invoicesTable,
  inventoryTable: inventoryStack.inventoryTable,
  auditLogsTable: auditLogsStack.auditLogsTable,
  usersTable: usersStack.usersTable,
  idempotencyTable: idempotencyStack.idempotencyTable,
  receiptsBucket: receiptsStack.receiptsBucket,
  region: envConfig.region,
});

apiStack.addDependency(ledgerStack);
apiStack.addDependency(receiptsStack);
apiStack.addDependency(invoicesStack);
apiStack.addDependency(inventoryStack);
apiStack.addDependency(auditLogsStack);
apiStack.addDependency(usersStack);
apiStack.addDependency(idempotencyStack);

app.synth();
