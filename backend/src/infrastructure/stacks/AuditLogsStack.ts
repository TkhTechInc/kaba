/**
 * AuditLogsStack - DynamoDB table for audit logs with TTL for retention.
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): AUDIT#<timestamp>#<id>
 * - ttl: Unix timestamp for automatic deletion (retention)
 *
 * Retention: Audit logs are automatically deleted after retention days (default 365).
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AuditLogsStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

/** Default retention in days before audit logs are deleted via TTL */
export const AUDIT_RETENTION_DAYS = 365;

export class AuditLogsStack extends cdk.Stack {
  public readonly auditLogsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AuditLogsStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const resourcePrefix = `QuickBooks-AuditLogs-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: `${resourcePrefix}-audit`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: enablePITR,
      timeToLiveAttribute: 'ttl',
    });

    new cdk.CfnOutput(this, 'AuditLogsTableName', {
      value: this.auditLogsTable.tableName,
      description: 'Audit logs DynamoDB table name (TTL enabled for retention)',
      exportName: `QuickBooks-${environment}-AuditLogsTableName`,
    });
  }
}
