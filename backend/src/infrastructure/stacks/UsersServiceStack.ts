/**
 * UsersServiceStack - DynamoDB table for user accounts and identity lookups
 *
 * Table design:
 * - pk (partition key): USER#<userId> | EMAIL#<email> | PHONE#<phone>
 * - sk (sort key): META
 *
 * A single-table pattern is used for the users domain:
 *   - Primary item:    pk=USER#<id>      sk=META  → full user record
 *   - Email lookup:    pk=EMAIL#<email>  sk=META  → { userId }
 *   - Phone lookup:    pk=PHONE#<phone>  sk=META  → { userId }
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface UsersServiceStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class UsersServiceStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: UsersServiceStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const resourcePrefix = `Kaba-UsersService-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;
    const enablePITR = config.database?.enablePITR ?? (environment === 'prod');

    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `${resourcePrefix}-users`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: enablePITR },
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB table name',
      exportName: `Kaba-${environment}-UsersTableName`,
    });
  }
}
