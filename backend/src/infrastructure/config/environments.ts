/**
 * Environment Configuration for QuickBooks West Africa CDK Stacks
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
  /** Frontend URL for CORS (e.g. https://dev.quickbooks.example.com). Localhost is always allowed. */
  frontendUrl?: string;
  database?: {
    useOnDemand: boolean;
    enablePITR: boolean;
  };
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
    sms: { enabled: false, provider: 'aws_sns', senderId: 'QuickBooks' },
    frontendUrl: 'http://localhost:3000',
    database: {
      useOnDemand: true,
      enablePITR: false,
    },
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
    sms: { enabled: true, provider: 'aws_sns', senderId: 'QuickBooks' },
    frontendUrl: undefined, // Set via: cdk deploy -c frontendUrl=https://staging.example.com
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
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
    sms: { enabled: true, provider: 'aws_sns', senderId: 'QuickBooks' },
    frontendUrl: undefined, // Set via: cdk deploy -c frontendUrl=https://app.example.com
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
  },
};

export function getEnvironmentConfig(environment: string): EnvironmentConfig {
  const config = ENVIRONMENTS[environment];
  if (!config) {
    throw new Error(
      `Unknown environment: ${environment}. Valid options: ${Object.keys(ENVIRONMENTS).join(', ')}`
    );
  }
  return config;
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
