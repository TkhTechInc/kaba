/**
 * LedgerServiceStack - DynamoDB table for ledger entries
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): LEDGER#<id>#<timestamp>
 * - GSI: businessId-createdAt for querying entries by business sorted by createdAt
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface LedgerServiceStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class LedgerServiceStack extends cdk.Stack {
  public readonly ledgerTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: LedgerServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const resourcePrefix = `QuickBooks-LedgerService-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.ledgerTable = new dynamodb.Table(this, 'LedgerTable', {
      tableName: `${resourcePrefix}-ledger`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: enablePITR,
      timeToLiveAttribute: 'ttl',
    });

    // GSI for querying by businessId sorted by createdAt
    this.ledgerTable.addGlobalSecondaryIndex({
      indexName: 'businessId-createdAt-index',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'LedgerTableName', {
      value: this.ledgerTable.tableName,
      description: 'Ledger DynamoDB table name',
      exportName: `QuickBooks-${environment}-LedgerTableName`,
    });
  }
}
