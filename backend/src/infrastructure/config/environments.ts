/**
 * Environment Configuration for Kaba CDK Stacks
 *
 * Usage:
 *   cdk deploy -c environment=dev
 *   cdk deploy -c environment=staging
 *   cdk deploy -c environment=prod
 */

export interface EnvironmentConfig {
  name: string;
  stage: string;
  region: string;
  apiVersion: string;
  scaling: {
    minCapacity: number;
    maxCapacity: number;
    autoScaling: boolean;
  };
  monitoring: {
    enableXRay: boolean;
    enableCloudWatchLogs: boolean;
    enableAlarms: boolean;
    logRetentionDays: number;
  };
  sms?: {
    enabled: boolean;
    provider?: 'aws_sns' | 'twilio' | 'africastalking';
    senderId?: string;
  };
  /** Frontend URL for CORS (e.g. https://dev.kaba.example.com). Localhost is always allowed. */
  frontendUrl?: string;
  /** Google OAuth — pass via cdk deploy -c googleClientId=... -c googleClientSecret=... */
  googleClientId?: string;
  googleClientSecret?: string;
  /** AI: receipts, mobile money parsing. Pass via -c aiProvider=openrouter -c aiModel=openrouter/free -c mobileMoneyParserProvider=llm */
  ai?: {
    provider?: string;
    model?: string;
    mobileMoneyParserProvider?: 'mock' | 'llm';
  };
  database?: {
    useOnDemand: boolean;
    enablePITR: boolean;
  };
  /** TKH Payments microservice base URL (e.g. https://<id>.execute-api.ca-central-1.amazonaws.com/dev/api/v1) */
  paymentsServiceUrl?: string;
  /** SNS topic ARN for payment events published by TKH Payments service */
  paymentsSnsTopicArn?: string;
}

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
  dev: {
    name: 'Development',
    stage: 'dev',
    region: 'ca-central-1',
    apiVersion: 'v1',
    scaling: {
      minCapacity: 1,
      maxCapacity: 4,
      autoScaling: true,
    },
    monitoring: {
      enableXRay: true,
      enableCloudWatchLogs: true,
      enableAlarms: false,
      logRetentionDays: 7,
    },
    sms: { enabled: false, provider: 'aws_sns', senderId: 'Kaba' },
    frontendUrl: 'http://localhost:3000',
    database: {
      useOnDemand: true,
      enablePITR: false,
    },
    paymentsServiceUrl: 'https://hfy53j9rjc.execute-api.ca-central-1.amazonaws.com/dev/api/v1',
    paymentsSnsTopicArn: 'arn:aws:sns:ca-central-1:497172038983:tkhtech-payment-events-dev',
  },
  staging: {
    name: 'Staging',
    stage: 'staging',
    region: 'af-south-1',
    apiVersion: 'v1',
    scaling: {
      minCapacity: 2,
      maxCapacity: 8,
      autoScaling: true,
    },
    monitoring: {
      enableXRay: true,
      enableCloudWatchLogs: true,
      enableAlarms: true,
      logRetentionDays: 14,
    },
    sms: { enabled: true, provider: 'aws_sns', senderId: 'Kaba' },
    frontendUrl: undefined, // Set via: cdk deploy -c frontendUrl=https://staging.example.com
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
    // Set via: cdk deploy -c paymentsServiceUrl=https://... -c paymentsSnsTopicArn=arn:...
    paymentsServiceUrl: undefined,
    paymentsSnsTopicArn: undefined,
  },
  prod: {
    name: 'Production',
    stage: 'prod',
    region: 'af-south-1',
    apiVersion: 'v1',
    scaling: {
      minCapacity: 4,
      maxCapacity: 20,
      autoScaling: true,
    },
    monitoring: {
      enableXRay: true,
      enableCloudWatchLogs: true,
      enableAlarms: true,
      logRetentionDays: 30,
    },
    sms: { enabled: true, provider: 'aws_sns', senderId: 'Kaba' },
    frontendUrl: undefined, // Set via: cdk deploy -c frontendUrl=https://app.example.com
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
    // Set via: cdk deploy -c paymentsServiceUrl=https://... -c paymentsSnsTopicArn=arn:...
    paymentsServiceUrl: undefined,
    paymentsSnsTopicArn: undefined,
  },
};

export function getEnvironmentConfig(environment: string, contextOverrides?: Record<string, string>): EnvironmentConfig {
  const config = ENVIRONMENTS[environment];
  if (!config) {
    throw new Error(
      `Unknown environment: ${environment}. Valid options: ${Object.keys(ENVIRONMENTS).join(', ')}`
    );
  }
  // Allow CDK context to override payments URLs at deploy time:
  // cdk deploy -c paymentsServiceUrl=https://... -c paymentsSnsTopicArn=arn:...
  return {
    ...config,
    paymentsServiceUrl: contextOverrides?.['paymentsServiceUrl'] ?? config.paymentsServiceUrl,
    paymentsSnsTopicArn: contextOverrides?.['paymentsSnsTopicArn'] ?? config.paymentsSnsTopicArn,
  };
}

export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  if (!config.region) {
    throw new Error('Environment config is missing region');
  }
  if (!config.name) {
    throw new Error('Environment config is missing name');
  }
  if (!config.stage) {
    throw new Error('Environment config is missing stage');
  }
}
