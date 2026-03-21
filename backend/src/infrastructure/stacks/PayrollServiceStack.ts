/**
 * PayrollServiceStack - DynamoDB table for payroll (employees, pay runs)
 *
 * Table design:
 * - pk (partition key): businessId
 * - sk (sort key): EMPLOYEE#<id> | PAYRUN#<id> | PAYRUN#<id>#LINE#<employeeId>
 * - GSI: businessId-createdAt for querying pay runs by date
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface PayrollServiceStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class PayrollServiceStack extends cdk.Stack {
  public readonly payrollTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: PayrollServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const tableName = `Kaba-Payroll-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.payrollTable = new dynamodb.Table(this, 'PayrollTable', {
      tableName,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: enablePITR },
    });

    this.payrollTable.addGlobalSecondaryIndex({
      indexName: 'businessId-createdAt-index',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'PayrollTableName', {
      value: this.payrollTable.tableName,
      description: 'Payroll DynamoDB table name',
      exportName: `Kaba-${environment}-PayrollTableName`,
    });
  }
}
