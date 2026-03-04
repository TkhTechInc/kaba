/**
 * QuickBooksApiStack - API Gateway REST + Lambda (NestJS), proxy to /api/v1/*
 *
 * Mirrors EventAppApiStack pattern: own RestApi, Lambda proxy for /api/v1/{proxy+}
 */
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvironmentConfig } from '../config/environments';

export interface QuickBooksApiStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
  ledgerTable: dynamodb.ITable;
  invoicesTable: dynamodb.ITable;
  auditLogsTable: dynamodb.ITable;
  usersTable: dynamodb.ITable;
  region: string;
  receiptsBucket?: s3.IBucket;
}

export class QuickBooksApiStack extends cdk.Stack {
  public readonly apiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: QuickBooksApiStackProps) {
    super(scope, id, props);

    const { environment, config, ledgerTable, invoicesTable, auditLogsTable, usersTable, region, receiptsBucket } = props;
    const resourcePrefix = `QuickBooks-Api-${environment}`;

    // SECURITY: JWT secret from Secrets Manager. Lambda resolves at runtime via JWT_SECRET_SECRET_NAME.
    // Create secret: quickbooks/{environment}/jwt-secret with key 'jwt_secret'
    const jwtSecretName = `quickbooks/${environment}/jwt-secret`;
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(this, 'JwtSecret', jwtSecretName);

    // Lambda asset: pre-bundled NestJS (npm run bundle -> dist/api-lambda)
    // __dirname is src/infrastructure/stacks (ts-node) or dist/infrastructure/stacks (compiled)
    const apiLambdaAsset = path.join(__dirname, '../../../dist/api-lambda');

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
        DYNAMODB_AUDIT_LOGS_TABLE: auditLogsTable.tableName,
        DYNAMODB_USERS_TABLE: usersTable.tableName,
        S3_RECEIPTS_BUCKET: receiptsBucket?.bucketName ?? '',
        SMS_ENABLED: config.sms?.enabled ? 'true' : 'false',
        SMS_PROVIDER: config.sms?.provider ?? 'aws_sns',
        SMS_SENDER_ID: config.sms?.senderId ?? 'QuickBooks',
      },
    });

    jwtSecret.grantRead(this.apiLambda);
    ledgerTable.grantReadWriteData(this.apiLambda);
    invoicesTable.grantReadWriteData(this.apiLambda);
    auditLogsTable.grantReadWriteData(this.apiLambda);
    usersTable.grantReadWriteData(this.apiLambda);

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
      logGroupName: `/quickbooks/${environment}/ledger-events`,
      retention: logs.RetentionDays.ONE_WEEK,
    });
    new events.Rule(this, 'LedgerEntryCreatedRule', {
      ruleName: `${resourcePrefix}-ledger-entry-created`,
      description: 'Matches ledger.entry.created for debugging and future consumers',
      eventPattern: {
        source: ['quickbooks.ledger'],
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
      description: 'QuickBooks West Africa API - /api/v1 (NestJS)',
      deployOptions: { stageName: environment },
      defaultCorsPreflightOptions: {
        allowOrigins: corsOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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
      description: 'QuickBooks API v1 base URL',
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
