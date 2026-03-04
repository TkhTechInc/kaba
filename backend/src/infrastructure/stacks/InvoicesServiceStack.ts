/**
 * InvoicesServiceStack - DynamoDB table for invoices (and customers in single-table design)
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): INVOICE#<id> or CUSTOMER#<id>
 * - GSI: businessId-createdAt for querying by business sorted by createdAt
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface InvoicesServiceStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class InvoicesServiceStack extends cdk.Stack {
  public readonly invoicesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: InvoicesServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const tableName = `QuickBooks-Invoices-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.invoicesTable = new dynamodb.Table(this, 'InvoicesTable', {
      tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: enablePITR,
    });

    // GSI for querying by businessId sorted by createdAt
    this.invoicesTable.addGlobalSecondaryIndex({
      indexName: 'businessId-createdAt-index',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'InvoicesTableName', {
      value: this.invoicesTable.tableName,
      description: 'Invoices DynamoDB table name',
      exportName: `QuickBooks-${environment}-InvoicesTableName`,
    });
  }
}
