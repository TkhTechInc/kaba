/**
 * AuditLogsStack - DynamoDB table for audit logs with TTL for retention.
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): AUDIT#<timestamp>#<id>
 * - ttl: Unix timestamp for automatic deletion (retention)
 *
 * Retention: Audit logs are automatically deleted after retention days (default 2555 / 7 years).
 * Override via config key `compliance.auditRetentionDays`.
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AuditLogsStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
  /** Override retention in days. Defaults to AUDIT_RETENTION_DAYS (2555 / 7 years). */
  retentionDays?: number;
}

/** Default retention in days before audit logs are deleted via TTL (7 years, matching repository default) */
export const AUDIT_RETENTION_DAYS = 2555;

export class AuditLogsStack extends cdk.Stack {
  public readonly auditLogsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AuditLogsStackProps) {
    super(scope, id, props);

    const { environment, config, retentionDays = AUDIT_RETENTION_DAYS } = props;
    const resourcePrefix = `Kaba-AuditLogs-${environment}`;

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

    // GSI 1: query all audit logs by userId (e.g. "all actions by user X")
    this.auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI 2: query full history of a specific entity (e.g. "all changes to invoice Y")
    this.auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'entityId-index',
      partitionKey: { name: 'entityId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'AuditLogsTableName', {
      value: this.auditLogsTable.tableName,
      description: `Audit logs DynamoDB table name (TTL enabled, retention ${retentionDays} days)`,
      exportName: `Kaba-${environment}-AuditLogsTableName`,
    });
  }
}
