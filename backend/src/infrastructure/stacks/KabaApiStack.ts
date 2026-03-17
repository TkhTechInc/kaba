/**
 * KabaApiStack - API Gateway REST + Lambda (NestJS), proxy to /api/v1/*
 *
 * Mirrors EventAppApiStack pattern: own RestApi, Lambda proxy for /api/v1/{proxy+}
 */
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvironmentConfig } from '../config/environments';

export interface KabaApiStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
  ledgerTable: dynamodb.ITable;
  invoicesTable: dynamodb.ITable;
  inventoryTable: dynamodb.ITable;
  auditLogsTable: dynamodb.ITable;
  usersTable: dynamodb.ITable;
  idempotencyTable: dynamodb.ITable;
  agentSessionsTable: dynamodb.ITable;
  region: string;
  receiptsBucket?: s3.IBucket;
}

export class KabaApiStack extends cdk.Stack {
  public readonly apiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: KabaApiStackProps) {
    super(scope, id, props);

    const { environment, config, ledgerTable, invoicesTable, inventoryTable, auditLogsTable, usersTable, idempotencyTable, agentSessionsTable, region, receiptsBucket } = props;
    const resourcePrefix = `Kaba-Api-${environment}`;

    // SECURITY: JWT secret from Secrets Manager. Lambda resolves at runtime via JWT_SECRET_SECRET_NAME.
    // Create secret: kaba/{environment}/jwt-secret with key 'jwt_secret'
    const jwtSecretName = `kaba/${environment}/jwt-secret`;
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(this, 'JwtSecret', jwtSecretName);
    const googleOAuthSecretName = `kaba/${environment}/google-oauth`;
    const googleOAuthSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GoogleOAuthSecret', googleOAuthSecretName);

    // Lambda assets: pre-bundled NestJS (npm run bundle -> dist/api-lambda)
    // __dirname is src/infrastructure/stacks (ts-node) or dist/infrastructure/stacks (compiled)
    const apiLambdaAsset = path.join(__dirname, '../../../dist/api-lambda');
    const recurringLambdaAsset = path.join(__dirname, '../../../dist/recurring-invoice-lambda');
    const planRenewalLambdaAsset = path.join(__dirname, '../../../dist/plan-renewal-lambda');
    const paymentReminderLambdaAsset = path.join(__dirname, '../../../dist/payment-reminder-lambda');
    const dailySummaryLambdaAsset = path.join(__dirname, '../../../dist/daily-summary-lambda');

    this.apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `${resourcePrefix}-handler`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(apiLambdaAsset),
      timeout: Duration.seconds(29),
      memorySize: 1024,
      tracing: config.monitoring.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        JWT_SECRET_SECRET_NAME: jwtSecretName,
        CORS_ORIGINS: config.frontendUrl ?? '',
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        DYNAMODB_INVOICES_TABLE: invoicesTable.tableName,
        DYNAMODB_INVENTORY_TABLE: inventoryTable.tableName,
        DYNAMODB_AUDIT_LOGS_TABLE: auditLogsTable.tableName,
        DYNAMODB_USERS_TABLE: usersTable.tableName,
        DYNAMODB_IDEMPOTENCY_TABLE: idempotencyTable.tableName,
        AGENT_SESSIONS_TABLE: agentSessionsTable.tableName,
        S3_RECEIPTS_BUCKET: receiptsBucket?.bucketName ?? '',
        SMS_ENABLED: config.sms?.enabled ? 'true' : 'false',
        SMS_PROVIDER: config.sms?.provider ?? 'aws_sns',
        SMS_SENDER_ID: config.sms?.senderId ?? 'Kaba',
        ...(config.googleClientId && { GOOGLE_CLIENT_ID: config.googleClientId }),
        ...(config.googleClientSecret && { GOOGLE_CLIENT_SECRET: config.googleClientSecret }),
        GOOGLE_OAUTH_SECRET_NAME: googleOAuthSecretName,
        FRONTEND_URL: config.frontendUrl ?? 'http://localhost:3000',
        API_URL: config.apiUrl ?? '',
        // AI: base provider + per-task model overrides. OPENROUTER_API_KEY loaded from secret.
        ...(config.ai?.provider && { AI_PROVIDER: config.ai.provider }),
        ...(config.ai?.model && { AI_MODEL: config.ai.model }),
        ...(config.ai?.mobileMoneyParserProvider && {
          MOBILE_MONEY_PARSER_PROVIDER: config.ai.mobileMoneyParserProvider,
        }),
        ...(config.ai?.intentModel && { AI_INTENT_MODEL: config.ai.intentModel }),
        ...(config.ai?.voiceModel && { AI_VOICE_MODEL: config.ai.voiceModel }),
        ...(config.ai?.loanModel && { AI_LOAN_MODEL: config.ai.loanModel }),
        ...(config.ai?.ledgerQaModel && { AI_LEDGER_QA_MODEL: config.ai.ledgerQaModel }),
        ...(config.ai?.visionModel && { AI_VISION_MODEL: config.ai.visionModel }),
        ...(config.ai?.embeddingModel && { AI_EMBEDDING_MODEL: config.ai.embeddingModel }),
        ...(config.ai?.provider === 'openrouter' && {
          OPENROUTER_API_KEY_SECRET_NAME: `kaba/${environment}/openrouter-api-key`,
        }),
        // Whisper STT — optional, enables audio upload path
        ...(config.ai?.whisperEnabled && {
          OPENAI_API_KEY_SECRET_NAME: `kaba/${environment}/openai-api-key`,
        }),
        ...(config.paymentsServiceUrl && {
          PAYMENTS_SERVICE_URL: config.paymentsServiceUrl,
        }),
        ...(config.tkhPaymentsApiKey && {
          TKH_PAYMENTS_API_KEY: config.tkhPaymentsApiKey,
        }),
        ...(config.kkiapayPublicKey && {
          KKIAPAY_PUBLIC_KEY: config.kkiapayPublicKey,
          KKIAPAY_SANDBOX: environment === 'prod' ? 'false' : 'true',
        }),
      },
    });

    jwtSecret.grantRead(this.apiLambda);
    googleOAuthSecret.grantRead(this.apiLambda);

    // Recurring invoice Lambda: runs daily at 6am UTC to process due schedules
    const recurringInvoiceLambda = new lambda.Function(this, 'RecurringInvoiceLambda', {
      functionName: `${resourcePrefix}-recurring-invoice`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(recurringLambdaAsset),
      timeout: Duration.minutes(5),
      memorySize: 256,
      environment: {
        DYNAMODB_INVOICES_TABLE: invoicesTable.tableName,
      },
    });
    invoicesTable.grantReadWriteData(recurringInvoiceLambda);

    // EventBridge rule: daily at 6am UTC
    new events.Rule(this, 'RecurringInvoiceScheduleRule', {
      ruleName: `${resourcePrefix}-recurring-invoice-daily`,
      description: 'Process due recurring invoice schedules daily at 6am UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '6', day: '*', month: '*', year: '*' }),
      targets: [new targets.LambdaFunction(recurringInvoiceLambda)],
    });

    // Plan renewal Lambda: sends renewal links to businesses with subscription expiring in 7 days, daily at 7am UTC
    const planRenewalLambda = new lambda.Function(this, 'PlanRenewalLambda', {
      functionName: `${resourcePrefix}-plan-renewal`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(planRenewalLambdaAsset),
      timeout: Duration.minutes(5),
      memorySize: 256,
      environment: {
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        FRONTEND_URL: config.frontendUrl ?? 'http://localhost:3000',
        SMS_PROVIDER: config.sms?.provider ?? 'aws_sns',
        SMS_SENDER_ID: config.sms?.senderId ?? 'Kaba',
      },
    });
    ledgerTable.grantReadWriteData(planRenewalLambda);

    new events.Rule(this, 'PlanRenewalScheduleRule', {
      ruleName: `${resourcePrefix}-plan-renewal-daily`,
      description: 'Send plan renewal links daily at 7am UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '7', day: '*', month: '*', year: '*' }),
      targets: [new targets.LambdaFunction(planRenewalLambda)],
    });

    // Payment reminder Lambda: sends SMS/WhatsApp reminders for overdue/pending debts daily at 8am UTC
    const paymentReminderLambda = new lambda.Function(this, 'PaymentReminderLambda', {
      functionName: `${resourcePrefix}-payment-reminder`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(paymentReminderLambdaAsset),
      timeout: Duration.minutes(5),
      memorySize: 256,
      environment: {
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        SMS_PROVIDER: config.sms?.provider ?? 'aws_sns',
        WHATSAPP_TOKEN: process.env['WHATSAPP_TOKEN'] ?? '',
        WHATSAPP_PHONE_NUMBER_ID: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
      },
    });
    ledgerTable.grantReadWriteData(paymentReminderLambda);

    // EventBridge rule: daily at 8am UTC
    new events.Rule(this, 'DailyReminderRule', {
      ruleName: `${resourcePrefix}-payment-reminder-daily`,
      description: 'Send payment reminders for overdue/pending debts daily at 8am UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '8', day: '*', month: '*', year: '*' }),
      targets: [new targets.LambdaFunction(paymentReminderLambda)],
    });

    // Daily summary Lambda: sends WhatsApp/SMS business summary to opted-in owners daily at 7am UTC
    const dailySummaryLambda = new lambda.Function(this, 'DailySummaryLambda', {
      functionName: `${resourcePrefix}-daily-summary`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(dailySummaryLambdaAsset),
      timeout: Duration.minutes(10),
      memorySize: 256,
      environment: {
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        WHATSAPP_TOKEN: process.env['WHATSAPP_TOKEN'] ?? '',
        WHATSAPP_PHONE_NUMBER_ID: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
      },
    });
    ledgerTable.grantReadData(dailySummaryLambda);

    // SNS for SMS fallback in daily summary
    dailySummaryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: ['*'],
        conditions: {
          Null: { 'sns:PhoneNumber': 'false' },
        },
      }),
    );

    // EventBridge rule: daily at 7am UTC
    new events.Rule(this, 'DailySummaryScheduleRule', {
      ruleName: `${resourcePrefix}-daily-summary`,
      description: 'Send daily business summary to opted-in owners at 7am UTC',
      schedule: events.Schedule.cron({ minute: '0', hour: '7', day: '*', month: '*', year: '*' }),
      targets: [new targets.LambdaFunction(dailySummaryLambda)],
    });

    // Payment event Lambda: triggered by SNS payment.completed events from TKH Payments service
    if (config.paymentsSnsTopicArn) {
      const paymentEventLambdaAsset = path.join(__dirname, '../../../dist/payment-event-lambda');
      const paymentEventLambda = new lambda.Function(this, 'PaymentEventLambda', {
        functionName: `${resourcePrefix}-payment-event`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset(paymentEventLambdaAsset),
        timeout: Duration.seconds(30),
        memorySize: 256,
        environment: {
          DYNAMODB_INVOICES_TABLE: invoicesTable.tableName,
          DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        },
      });
      invoicesTable.grantReadWriteData(paymentEventLambda);
      ledgerTable.grantReadWriteData(paymentEventLambda);

      const paymentsTopic = sns.Topic.fromTopicArn(
        this,
        'PaymentsTopic',
        config.paymentsSnsTopicArn,
      );
      paymentEventLambda.addEventSource(
        new lambdaEventSources.SnsEventSource(paymentsTopic, {
          filterPolicy: {
            appId: sns.SubscriptionFilter.stringFilter({
              allowlist: ['kaba'],
            }),
          },
        }),
      );
    }

    // WhatsApp webhook Lambda: handles Meta verification + incoming messages
    const whatsappWebhookAsset = path.join(__dirname, '../../../dist/lambda/whatsapp-webhook');
    const whatsappWebhookLambda = new lambda.Function(this, 'WhatsAppWebhookLambda', {
      functionName: `${resourcePrefix}-whatsapp-webhook`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(whatsappWebhookAsset),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        DYNAMODB_INVOICES_TABLE: invoicesTable.tableName,
        DYNAMODB_INVENTORY_TABLE: inventoryTable.tableName,
        DYNAMODB_AUDIT_LOGS_TABLE: auditLogsTable.tableName,
        DYNAMODB_USERS_TABLE: usersTable.tableName,
        DYNAMODB_IDEMPOTENCY_TABLE: idempotencyTable.tableName,
        WHATSAPP_TOKEN: process.env['WHATSAPP_TOKEN'] ?? '',
        WHATSAPP_PHONE_NUMBER_ID: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
        WHATSAPP_APP_SECRET: process.env['WHATSAPP_APP_SECRET'] ?? '',
        WHATSAPP_VERIFY_TOKEN: process.env['WHATSAPP_VERIFY_TOKEN'] ?? '',
      },
    });
    ledgerTable.grantReadWriteData(whatsappWebhookLambda);
    invoicesTable.grantReadWriteData(whatsappWebhookLambda);
    inventoryTable.grantReadWriteData(whatsappWebhookLambda);
    auditLogsTable.grantReadWriteData(whatsappWebhookLambda);
    usersTable.grantReadWriteData(whatsappWebhookLambda);
    idempotencyTable.grantReadWriteData(whatsappWebhookLambda);

    // Telegram webhook Lambda: handles incoming Telegram updates
    const telegramWebhookAsset = path.join(__dirname, '../../../dist/lambda/telegram-webhook');
    const telegramWebhookLambda = new lambda.Function(this, 'TelegramWebhookLambda', {
      functionName: `${resourcePrefix}-telegram-webhook`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(telegramWebhookAsset),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        DYNAMODB_LEDGER_TABLE: ledgerTable.tableName,
        DYNAMODB_INVOICES_TABLE: invoicesTable.tableName,
        DYNAMODB_INVENTORY_TABLE: inventoryTable.tableName,
        DYNAMODB_AUDIT_LOGS_TABLE: auditLogsTable.tableName,
        DYNAMODB_USERS_TABLE: usersTable.tableName,
        DYNAMODB_IDEMPOTENCY_TABLE: idempotencyTable.tableName,
        TELEGRAM_BOT_TOKEN: process.env['TELEGRAM_BOT_TOKEN'] ?? '',
        TELEGRAM_WEBHOOK_SECRET: process.env['TELEGRAM_WEBHOOK_SECRET'] ?? '',
      },
    });
    ledgerTable.grantReadWriteData(telegramWebhookLambda);
    invoicesTable.grantReadWriteData(telegramWebhookLambda);
    inventoryTable.grantReadWriteData(telegramWebhookLambda);
    auditLogsTable.grantReadWriteData(telegramWebhookLambda);
    usersTable.grantReadWriteData(telegramWebhookLambda);
    idempotencyTable.grantReadWriteData(telegramWebhookLambda);

    // OpenRouter API key for AI (when provider=openrouter). Create secret before deploy.
    if (config.ai?.provider === 'openrouter') {
      const openRouterSecretName = `kaba/${environment}/openrouter-api-key`;
      const openRouterSecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        'OpenRouterSecret',
        openRouterSecretName
      );
      openRouterSecret.grantRead(this.apiLambda);
    }
    ledgerTable.grantReadWriteData(this.apiLambda);
    invoicesTable.grantReadWriteData(this.apiLambda);
    inventoryTable.grantReadWriteData(this.apiLambda);
    auditLogsTable.grantReadWriteData(this.apiLambda);
    usersTable.grantReadWriteData(this.apiLambda);
    idempotencyTable.grantReadWriteData(this.apiLambda);
    agentSessionsTable.grantReadWriteData(this.apiLambda);

    if (receiptsBucket) {
      receiptsBucket.grantReadWrite(this.apiLambda);
    }

    // SNS for SMS OTP (AWS SNS SMS) — scoped to direct phone number publishes only
    this.apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        resources: ['*'],
        conditions: {
          Null: { 'sns:PhoneNumber': 'false' },
        },
      })
    );

    // EventBridge PutEvents for ledger.entry.created (default event bus)
    const defaultEventBusArn = this.formatArn({
      service: 'events',
      resource: 'event-bus',
      resourceName: 'default',
    });
    this.apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [defaultEventBusArn],
      })
    );

    // EventBridge rule: match ledger.entry.created for future consumers / debugging
    const ledgerEventsLogGroup = new logs.LogGroup(this, 'LedgerEventsLog', {
      logGroupName: `/kaba/${environment}/ledger-events`,
      retention: logs.RetentionDays.ONE_WEEK,
    });
    new events.Rule(this, 'LedgerEntryCreatedRule', {
      ruleName: `${resourcePrefix}-ledger-entry-created`,
      description: 'Matches ledger.entry.created for debugging and future consumers',
      eventPattern: {
        source: ['kaba.ledger'],
        detailType: ['LedgerEntryCreated'],
      },
      targets: [new targets.CloudWatchLogGroup(ledgerEventsLogGroup)],
    });

    // Own RestApi to avoid cyclic dependency (Method + Lambda in same stack)
    const localhostOrigins = environment !== 'prod'
      ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3008']
      : [];
    const corsOrigins = [
      ...localhostOrigins,
      ...(config.frontendUrl ? [config.frontendUrl] : []),
    ].filter(Boolean);
    const restApi = new apigateway.RestApi(this, 'Api', {
      restApiName: `${resourcePrefix}-api`,
      description: 'Kaba API - /api/v1 (NestJS)',
      deployOptions: { stageName: environment },
      defaultCorsPreflightOptions: {
        allowOrigins: corsOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key'],
        allowCredentials: true,
      },
    });

    const apiResource = restApi.root.addResource('api');
    const v1Resource = apiResource.addResource('v1');
    const proxyResource = v1Resource.addResource('{proxy+}');

    const integration = new apigateway.LambdaIntegration(this.apiLambda, {
      proxy: true,
      allowTestInvoke: true,
    });

    proxyResource.addMethod('ANY', integration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestParameters: {
        'method.request.path.proxy': true,
      },
    });

    // Webhook routes: /webhooks/whatsapp (GET + POST) and /webhooks/telegram (POST)
    const webhooksResource = restApi.root.addResource('webhooks');

    const whatsappWebhookResource = webhooksResource.addResource('whatsapp');
    const whatsappIntegration = new apigateway.LambdaIntegration(whatsappWebhookLambda, { proxy: true });
    whatsappWebhookResource.addMethod('GET', whatsappIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });
    whatsappWebhookResource.addMethod('POST', whatsappIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    const telegramWebhookResource = webhooksResource.addResource('telegram');
    const telegramIntegration = new apigateway.LambdaIntegration(telegramWebhookLambda, { proxy: true });
    telegramWebhookResource.addMethod('POST', telegramIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // OAuth callback URL (real domain for dev/staging/prod; API Gateway URL only for local)
    const callbackUrl = config.apiUrl
      ? `${config.apiUrl}/api/v1/auth/google/callback`
      : `https://${restApi.restApiId}.execute-api.${this.region}.amazonaws.com/${environment}/api/v1/auth/google/callback`;
    this.apiLambda.addEnvironment('GOOGLE_CALLBACK_URL', callbackUrl);

    // AWS WAF v2 - only in prod (REGIONAL scope for API Gateway)
    if (environment === 'prod') {
      const webAcl = new wafv2.CfnWebACL(this, 'ApiWaf', {
        name: `${resourcePrefix}-waf`,
        scope: 'REGIONAL',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${resourcePrefix}-waf`,
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'AWS-AWSManagedRulesCommonRuleSet',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesCommonRuleSetMetric',
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
            priority: 2,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'AWSManagedRulesKnownBadInputsRuleSetMetric',
              sampledRequestsEnabled: true,
            },
          },
        ],
      });

      const apiStageArn = `arn:aws:apigateway:${region}::/restapis/${restApi.restApiId}/stages/${environment}`;
      new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
        resourceArn: apiStageArn,
        webAclArn: webAcl.attrArn,
      });
    }


    new cdk.CfnOutput(this, 'ApiV1BaseUrl', {
      value: `${restApi.url}api/v1`,
      description: 'Kaba API v1 base URL',
      exportName: `${resourcePrefix}-ApiV1Url`,
    });

    if (config.monitoring.enableAlarms) {
      new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
        alarmName: `${resourcePrefix}-lambda-errors`,
        metric: this.apiLambda.metricErrors({ period: Duration.minutes(5) }),
        threshold: 10,
        evaluationPeriods: 1,
        alarmDescription: 'API Lambda error count exceeded threshold',
      });
    }
  }
}
