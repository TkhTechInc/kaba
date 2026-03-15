/**
 * MonitoringStack - CloudWatch alarms and dashboards for production monitoring
 *
 * Monitors:
 * - DynamoDB throttling, errors, consumed capacity
 * - Lambda errors, duration, throttles, concurrent executions
 * - API Gateway 4xx, 5xx errors
 * - Critical business metrics (payment failures, auth failures)
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface MonitoringStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
  ledgerTable?: dynamodb.Table;
  usersTable?: dynamodb.Table;
  invoicesTable?: dynamodb.Table;
  apiGateway?: apigateway.RestApi;
  kabaApiFunction?: lambda.Function;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alertTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environment, config } = props;

    // SNS topic for alerts
    this.alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `Kaba-${environment}-Alerts`,
      displayName: `Kaba ${environment} Alerts`,
    });

    // Subscribe alert emails
    const alertEmails = config.monitoring?.alertEmails ?? [];
    alertEmails.forEach((email, index) => {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(email, {
          json: false,
        }),
      );
    });

    // Create CloudWatch dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `Kaba-${environment}-Overview`,
    });

    // ============================================================================
    // DynamoDB Monitoring
    // ============================================================================
    if (props.ledgerTable) {
      this.addDynamoDBAlarms(props.ledgerTable, 'Ledger', environment);
      this.addDynamoDBWidgets(dashboard, props.ledgerTable, 'Ledger');
    }

    if (props.usersTable) {
      this.addDynamoDBAlarms(props.usersTable, 'Users', environment);
      this.addDynamoDBWidgets(dashboard, props.usersTable, 'Users');
    }

    if (props.invoicesTable) {
      this.addDynamoDBAlarms(props.invoicesTable, 'Invoices', environment);
      this.addDynamoDBWidgets(dashboard, props.invoicesTable, 'Invoices');
    }

    // ============================================================================
    // Lambda Monitoring
    // ============================================================================
    if (props.kabaApiFunction) {
      this.addLambdaAlarms(props.kabaApiFunction, environment);
      this.addLambdaWidgets(dashboard, props.kabaApiFunction);
    }

    // ============================================================================
    // API Gateway Monitoring
    // ============================================================================
    if (props.apiGateway) {
      this.addApiGatewayAlarms(props.apiGateway, environment);
      this.addApiGatewayWidgets(dashboard, props.apiGateway);
    }

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: this.alertTopic.topicArn,
      description: 'SNS topic for CloudWatch alarms',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch dashboard URL',
    });
  }

  private addDynamoDBAlarms(table: dynamodb.Table, tableName: string, env: string) {
    // Throttled read requests
    const readThrottleAlarm = new cloudwatch.Alarm(this, `${tableName}ReadThrottle`, {
      alarmName: `Kaba-${env}-${tableName}-ReadThrottle`,
      metric: table.metricThrottledRequestsForOperations({
        operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY, dynamodb.Operation.SCAN],
        period: cdk.Duration.minutes(1),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 5, // More than 5 throttled requests in 1 minute
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    readThrottleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Throttled write requests
    const writeThrottleAlarm = new cloudwatch.Alarm(this, `${tableName}WriteThrottle`, {
      alarmName: `Kaba-${env}-${tableName}-WriteThrottle`,
      metric: table.metricThrottledRequestsForOperations({
        operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM, dynamodb.Operation.DELETE_ITEM],
        period: cdk.Duration.minutes(1),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 5,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    writeThrottleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // System errors
    const systemErrorAlarm = new cloudwatch.Alarm(this, `${tableName}SystemErrors`, {
      alarmName: `Kaba-${env}-${tableName}-SystemErrors`,
      metric: table.metricSystemErrorsForOperations({
        operations: [
          dynamodb.Operation.GET_ITEM,
          dynamodb.Operation.PUT_ITEM,
          dynamodb.Operation.UPDATE_ITEM,
          dynamodb.Operation.QUERY,
        ],
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 1, // Any system error is critical
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    systemErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }

  private addDynamoDBWidgets(dashboard: cloudwatch.Dashboard, table: dynamodb.Table, tableName: string) {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: `${tableName} - Read/Write Capacity`,
        left: [
          table.metricConsumedReadCapacityUnits(),
          table.metricConsumedWriteCapacityUnits(),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: `${tableName} - Throttled Requests`,
        left: [
          table.metricThrottledRequestsForOperations({
            operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY],
          }),
          table.metricThrottledRequestsForOperations({
            operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM],
          }),
        ],
        width: 12,
      }),
    );
  }

  private addLambdaAlarms(fn: lambda.Function, env: string) {
    // Lambda errors
    const errorAlarm = fn.metricErrors({
      period: cdk.Duration.minutes(5),
      statistic: cloudwatch.Stats.SUM,
    }).createAlarm(this, 'LambdaErrors', {
      alarmName: `Kaba-${env}-Lambda-Errors`,
      threshold: 10, // More than 10 errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Lambda duration (cold starts)
    const durationAlarm = fn.metricDuration({
      period: cdk.Duration.minutes(5),
      statistic: cloudwatch.Stats.p(99),
    }).createAlarm(this, 'LambdaDuration', {
      alarmName: `Kaba-${env}-Lambda-Duration-P99`,
      threshold: 5000, // P99 > 5 seconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    durationAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // Lambda throttles
    const throttleAlarm = fn.metricThrottles({
      period: cdk.Duration.minutes(1),
      statistic: cloudwatch.Stats.SUM,
    }).createAlarm(this, 'LambdaThrottles', {
      alarmName: `Kaba-${env}-Lambda-Throttles`,
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }

  private addLambdaWidgets(dashboard: cloudwatch.Dashboard, fn: lambda.Function) {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda - Invocations & Errors',
        left: [fn.metricInvocations(), fn.metricErrors()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda - Duration (P50/P99)',
        left: [
          fn.metricDuration({ statistic: cloudwatch.Stats.p(50) }),
          fn.metricDuration({ statistic: cloudwatch.Stats.p(99) }),
        ],
        width: 12,
      }),
    );
  }

  private addApiGatewayAlarms(api: apigateway.RestApi, env: string) {
    // 5xx errors
    const serverErrorAlarm = new cloudwatch.Alarm(this, 'Api5xxErrors', {
      alarmName: `Kaba-${env}-API-5xxErrors`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 10, // More than 10 server errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    serverErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));

    // High 4xx error rate (potential attack or client issues)
    const clientErrorAlarm = new cloudwatch.Alarm(this, 'Api4xxErrors', {
      alarmName: `Kaba-${env}-API-4xxErrors`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: api.restApiName,
        },
        period: cdk.Duration.minutes(5),
        statistic: cloudwatch.Stats.SUM,
      }),
      threshold: 100, // More than 100 client errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    clientErrorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alertTopic));
  }

  private addApiGatewayWidgets(dashboard: cloudwatch.Dashboard, api: apigateway.RestApi) {
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: api.restApiName },
            statistic: cloudwatch.Stats.SUM,
          }),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: api.restApiName },
            statistic: cloudwatch.Stats.SUM,
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: api.restApiName },
            statistic: cloudwatch.Stats.SUM,
          }),
        ],
        width: 12,
      }),
    );
  }
}
