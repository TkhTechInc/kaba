/**
 * Environment Configuration for Kaba CDK Stacks
 *
 * Four environments: local, dev, staging, prod.
 * - local: localhost only (npm run dev)
 * - dev, staging, prod: MUST use real domains (not API Gateway URLs).
 *   Override via: cdk deploy -c apiUrl=... -c frontendUrl=...
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
  /** AWS account ID for this environment. CDK deploys into this account. */
  awsAccountId?: string;
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
    alertEmails?: string[];
  };
  sms?: {
    enabled: boolean;
    provider?: 'aws_sns' | 'twilio' | 'africastalking';
    senderId?: string;
  };
  /** Frontend URL for CORS. Dev/staging/prod must use real domain (not API Gateway URL). */
  frontendUrl?: string;
  /** Public API URL for trust share links, webhooks, OAuth callbacks. Dev/staging/prod must use real domain. */
  apiUrl?: string;
  /** Google OAuth — pass via cdk deploy -c googleClientId=... -c googleClientSecret=... */
  googleClientId?: string;
  googleClientSecret?: string;
  /**
   * AI configuration. Base provider selected via `provider`.
   * Per-task model overrides route specific workloads to optimised models via OpenRouter.
   * All model strings are OpenRouter model IDs (e.g. "mistralai/mistral-small-3.2-24b-instruct").
   */
  ai?: {
    provider?: string;
    /** Default/fallback model when no task-specific model is set */
    model?: string;
    mobileMoneyParserProvider?: 'mock' | 'llm';
      /** Fast chat-intent classification — default: Gemma 3 27B (6/7 West African language benchmark) */
    intentModel?: string;
    /** Multilingual voice-to-transaction extraction — default: Qwen3.5-Flash */
    voiceModel?: string;
    /** Reasoning model for loan readiness scoring — default: DeepSeek R1 0528 */
    loanModel?: string;
    /** Ledger Q&A — default: Llama 3.3 70B Instruct */
    ledgerQaModel?: string;
    /** Vision/receipt extraction — default: Qwen3 VL 235B */
    visionModel?: string;
    /** Embeddings — default: Qwen3 Embedding 8B */
    embeddingModel?: string;
    /** Enable Whisper STT via OpenAI API (requires OPENAI_API_KEY secret in Secrets Manager) */
    whisperEnabled?: boolean;
  };
  database?: {
    useOnDemand: boolean;
    enablePITR: boolean;
  };
  /** TKH Payments microservice base URL (e.g. https://<id>.execute-api.ca-central-1.amazonaws.com/dev/api/v1) */
  paymentsServiceUrl?: string;
  /** TKH Payments API key sent as X-API-Key by PaymentsClient */
  tkhPaymentsApiKey?: string;
  /** SNS topic ARN for payment events published by TKH Payments service */
  paymentsSnsTopicArn?: string;
}

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
  dev: {
    name: 'Development',
    stage: 'dev',
    region: 'ca-central-1',
    // awsAccountId omitted: uses current credentials (CDK_DEFAULT_ACCOUNT). Override: cdk deploy -c account=110044886269
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
    frontendUrl: 'https://dev.kabasika.com',
    apiUrl: 'https://api.dev.kabasika.com',
    database: {
      useOnDemand: true,
      enablePITR: false,
    },
    paymentsServiceUrl: 'https://dev-payments.tkhtech.com/api/v1',
    tkhPaymentsApiKey: undefined,
    // Cross-account SNS requires topic owner to add resource policy. Omit for deploy without org role.
    paymentsSnsTopicArn: undefined,
    ai: {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3-0324',
      mobileMoneyParserProvider: 'llm',
      intentModel: 'google/gemma-3-27b-it',
      voiceModel: 'qwen/qwen3.5-flash-02-23',
      loanModel: 'deepseek/deepseek-r1-0528',
      ledgerQaModel: 'meta-llama/llama-3.3-70b-instruct',
      visionModel: 'qwen/qwen3-vl-235b-a22b-instruct',
      embeddingModel: 'qwen/qwen3-embedding-8b',
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
    sms: { enabled: true, provider: 'aws_sns', senderId: 'Kaba' },
    frontendUrl: 'https://staging.kabasika.com',
    apiUrl: 'https://api.staging.kabasika.com',
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
    paymentsServiceUrl: undefined,
    tkhPaymentsApiKey: undefined,
    paymentsSnsTopicArn: undefined,
    ai: {
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat-v3-0324',
      mobileMoneyParserProvider: 'llm',
      intentModel: 'google/gemma-3-27b-it',
      voiceModel: 'qwen/qwen3.5-flash-02-23',
      loanModel: 'deepseek/deepseek-r1-0528',
      ledgerQaModel: 'meta-llama/llama-3.3-70b-instruct',
      visionModel: 'qwen/qwen3-vl-235b-a22b-instruct',
      embeddingModel: 'qwen/qwen3-embedding-8b',
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
    sms: { enabled: true, provider: 'aws_sns', senderId: 'Kaba' },
    frontendUrl: 'https://app.kabasika.com',
    apiUrl: 'https://api.kabasika.com',
    database: {
      useOnDemand: true,
      enablePITR: true,
    },
    paymentsServiceUrl: undefined,
    tkhPaymentsApiKey: undefined,
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
  // CDK context overrides: cdk deploy -c apiUrl=... -c frontendUrl=... -c paymentsServiceUrl=...
  return {
    ...config,
    apiUrl: contextOverrides?.['apiUrl'] ?? config.apiUrl,
    frontendUrl: contextOverrides?.['frontendUrl'] ?? config.frontendUrl,
    paymentsServiceUrl: contextOverrides?.['paymentsServiceUrl'] ?? config.paymentsServiceUrl,
    tkhPaymentsApiKey: contextOverrides?.['tkhPaymentsApiKey'] ?? config.tkhPaymentsApiKey,
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
  // Dev/staging/prod must use real domains (not API Gateway URLs)
  if (['dev', 'staging', 'prod'].includes(config.stage)) {
    if (!config.apiUrl) throw new Error(`${config.stage}: apiUrl is required (real domain)`);
    if (!config.frontendUrl) throw new Error(`${config.stage}: frontendUrl is required (real domain)`);
    const bad = (url: string) => url.includes('execute-api') || url.includes('amazonaws.com');
    if (bad(config.apiUrl)) {
      throw new Error(`${config.stage}: apiUrl must be a real domain, not API Gateway URL: ${config.apiUrl}`);
    }
    if (bad(config.frontendUrl)) {
      throw new Error(`${config.stage}: frontendUrl must be a real domain, not API Gateway URL: ${config.frontendUrl}`);
    }
  }
}
