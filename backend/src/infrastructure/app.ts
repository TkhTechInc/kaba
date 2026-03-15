#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LedgerServiceStack } from './stacks/LedgerServiceStack';
import { ReceiptsStorageStack } from './stacks/ReceiptsStorageStack';
import { InvoicesServiceStack } from './stacks/InvoicesServiceStack';
import { InventoryServiceStack } from './stacks/InventoryServiceStack';
import { AuditLogsStack } from './stacks/AuditLogsStack';
import { UsersServiceStack } from './stacks/UsersServiceStack';
import { KabaApiStack } from './stacks/KabaApiStack';
import { IdempotencyStack } from './stacks/IdempotencyStack';
import { AgentSessionsStack } from './stacks/AgentSessionsStack';
import { getEnvironmentConfig, validateEnvironmentConfig } from './config/environments';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const account =
  app.node.tryGetContext('account') ||
  process.env['CDK_DEPLOY_ACCOUNT'] ||
  process.env['CDK_DEFAULT_ACCOUNT'];

const contextOverrides: Record<string, string> = {};
for (const key of ['apiUrl', 'frontendUrl', 'paymentsServiceUrl', 'tkhPaymentsApiKey', 'paymentsSnsTopicArn']) {
  const v = app.node.tryGetContext(key) as string | undefined;
  if (v) contextOverrides[key] = v;
}
const envConfig = getEnvironmentConfig(environment, contextOverrides);

const googleClientId = app.node.tryGetContext('googleClientId') as string | undefined;
const googleClientSecret = app.node.tryGetContext('googleClientSecret') as string | undefined;
const aiProvider = app.node.tryGetContext('aiProvider') as string | undefined;
const aiModel = app.node.tryGetContext('aiModel') as string | undefined;
const mobileMoneyParserProvider = app.node.tryGetContext('mobileMoneyParserProvider') as 'mock' | 'llm' | undefined;
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

console.log(`🚀 Kaba - Deploying to ${environment}`);
console.log(`📍 Region: ${envConfig.region}`);

const bootstrapQualifier =
  (app.node.tryGetContext('@aws-cdk/core:bootstrapQualifier') as string) || 'tkh';

const commonProps: cdk.StackProps = {
  env: {
    account: envConfig.awsAccountId || account,
    region: envConfig.region,
  },
  synthesizer: new cdk.DefaultStackSynthesizer({ qualifier: bootstrapQualifier }),
};

const ledgerStack = new LedgerServiceStack(app, `Kaba-LedgerService-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Ledger DynamoDB table',
  config: envConfig,
});

const receiptsStack = new ReceiptsStorageStack(app, `Kaba-Receipts-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - S3 bucket for receipt storage',
  config: envConfig,
});

const invoicesStack = new InvoicesServiceStack(app, `Kaba-InvoicesService-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Invoices DynamoDB table',
  config: envConfig,
});

const inventoryStack = new InventoryServiceStack(app, `Kaba-InventoryService-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Inventory DynamoDB table',
  config: envConfig,
});

const auditLogsStack = new AuditLogsStack(app, `Kaba-AuditLogs-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Audit logs DynamoDB table',
  config: envConfig,
});

const usersStack = new UsersServiceStack(app, `Kaba-UsersService-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Users DynamoDB table',
  config: envConfig,
});

const idempotencyStack = new IdempotencyStack(app, `Kaba-Idempotency-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Idempotency DynamoDB table',
  config: envConfig,
});

const agentSessionsStack = new AgentSessionsStack(app, `Kaba-AgentSessions-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - Agent sessions DynamoDB table',
  config: envConfig,
});

const apiStack = new KabaApiStack(app, `Kaba-Api-${environment}`, {
  ...commonProps,
  environment,
  description: 'Kaba - API Gateway + Lambda (/api/v1/*)',
  config: envConfig,
  ledgerTable: ledgerStack.ledgerTable,
  invoicesTable: invoicesStack.invoicesTable,
  inventoryTable: inventoryStack.inventoryTable,
  auditLogsTable: auditLogsStack.auditLogsTable,
  usersTable: usersStack.usersTable,
  idempotencyTable: idempotencyStack.idempotencyTable,
  agentSessionsTable: agentSessionsStack.agentSessionsTable,
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
apiStack.addDependency(agentSessionsStack);

app.synth();
