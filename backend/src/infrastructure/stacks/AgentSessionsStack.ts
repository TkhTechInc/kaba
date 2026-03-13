import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AgentSessionsStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class AgentSessionsStack extends cdk.Stack {
  public readonly agentSessionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AgentSessionsStackProps) {
    super(scope, id, props);

    const { environment, config } = props;
    const resourcePrefix = `Kaba-AgentSessions-${environment}`;

    const useOnDemand = config.database?.useOnDemand ?? true;

    this.agentSessionsTable = new dynamodb.Table(this, 'AgentSessionsTable', {
      tableName: resourcePrefix,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: useOnDemand
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    new cdk.CfnOutput(this, 'AgentSessionsTableName', {
      value: this.agentSessionsTable.tableName,
      description: 'Agent sessions DynamoDB table name',
      exportName: `Kaba-${environment}-AgentSessionsTableName`,
    });
  }
}
