/**
 * InventoryServiceStack - DynamoDB table for products (inventory)
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): PRODUCT#<id>
 * - GSI: businessId-createdAt for querying by business sorted by createdAt
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface InventoryServiceStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class InventoryServiceStack extends cdk.Stack {
  public readonly inventoryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: InventoryServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const tableName = `QuickBooks-Inventory-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: enablePITR,
    });

    this.inventoryTable.addGlobalSecondaryIndex({
      indexName: 'businessId-createdAt-index',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'InventoryTableName', {
      value: this.inventoryTable.tableName,
      description: 'Inventory DynamoDB table name',
      exportName: `QuickBooks-${environment}-InventoryTableName`,
    });
  }
}
