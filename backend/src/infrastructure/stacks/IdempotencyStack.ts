/**
 * IdempotencyStack - DynamoDB table for idempotency keys
 *
 * Used to safely replay offline-queued mutations without creating duplicates.
 * pk = idempotencyKey (UUID), sk = META, ttl for auto-expiry (24h).
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface IdempotencyStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

const TTL_DAYS = 1; // 24 hours

export class IdempotencyStack extends cdk.Stack {
  public readonly idempotencyTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: IdempotencyStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const resourcePrefix = `QuickBooks-Idempotency-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;

    this.idempotencyTable = new dynamodb.Table(this, 'IdempotencyTable', {
      tableName: `${resourcePrefix}`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    new cdk.CfnOutput(this, 'IdempotencyTableName', {
      value: this.idempotencyTable.tableName,
      description: 'Idempotency DynamoDB table name',
      exportName: `QuickBooks-${environment}-IdempotencyTableName`,
    });
  }
}
