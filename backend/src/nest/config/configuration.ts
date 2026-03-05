const DEV_JWT_SECRET = 'dev-secret-change-in-production';

export function configuration() {
  const nodeEnv = process.env['NODE_ENV'] || 'dev';
  const jwtSecret = process.env['JWT_SECRET'] || DEV_JWT_SECRET;

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret === DEV_JWT_SECRET) {
      throw new Error(
        'JWT_SECRET must be set to a secure value in production. Use JWT_SECRET_SECRET_NAME for Lambda (Secrets Manager) or set JWT_SECRET env var.'
      );
    }
  }

  return {
  port: parseInt(process.env['PORT'] || '3001', 10),
  environment: nodeEnv,
  region: process.env['AWS_REGION'] || 'af-south-1',
  cors: {
    origins: [
      ...(process.env['CORS_ORIGINS'] || '').split(',').filter(Boolean),
      ...(nodeEnv !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3008']
        : []),
    ],
  },
  dynamodb: {
    ledgerTable: process.env['DYNAMODB_LEDGER_TABLE'] || 'QuickBooks-Ledger-dev',
    invoicesTable: process.env['DYNAMODB_INVOICES_TABLE'] || 'QuickBooks-Invoices-dev',
    inventoryTable: process.env['DYNAMODB_INVENTORY_TABLE'] || 'QuickBooks-Inventory-dev',
    auditLogsTable:
      process.env['DYNAMODB_AUDIT_LOGS_TABLE'] || 'QuickBooks-AuditLogs-dev-audit',
    usersTable:
      process.env['DYNAMODB_USERS_TABLE'] || 'QuickBooks-UsersService-dev-users',
    idempotencyTable:
      process.env['DYNAMODB_IDEMPOTENCY_TABLE'] || 'QuickBooks-Idempotency-dev',
  },
  compliance: {
    /** Retention days for audit logs before TTL deletion. Default 365. */
    auditRetentionDays: parseInt(process.env['AUDIT_RETENTION_DAYS'] || '365', 10),
    /** Grace period (days) before hard delete after erasure. Default 30. */
    erasureGracePeriodDays: parseInt(process.env['ERASURE_GRACE_PERIOD_DAYS'] || '30', 10),
  },
  ai: {
    provider: process.env['AI_PROVIDER'] || '',
    model: process.env['AI_MODEL'] || '',
    bedrockRegion: process.env['AI_BEDROCK_REGION'] || 'us-east-1',
    // Provider-specific API keys are read directly from env vars in ai.module.ts (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)
  },
  tax: {
    provider: process.env['TAX_PROVIDER'] || '',
  },
  fiscal: {
    /** Benin e-MECeF: JWT token from developper.impots.bj (test) or sygmef.impots.bj (prod) */
    mecefBeninJwt: process.env['MECEF_BENIN_JWT'] || '',
    /** Benin e-MECeF base URL. Default: test env. Use https://sygmef.impots.bj for prod */
    mecefBeninBaseUrl:
      process.env['MECEF_BENIN_BASE_URL'] || 'https://developper.impots.bj',
    /** Côte d'Ivoire FNE: API key from services.fne.dgi.gouv.ci */
    fneCiApiKey: process.env['FNE_CI_API_KEY'] || '',
    /** Côte d'Ivoire FNE base URL */
    fneCiBaseUrl:
      process.env['FNE_CI_BASE_URL'] || 'https://services.fne.dgi.gouv.ci',
  },
  s3: {
    receiptsBucket: process.env['S3_RECEIPTS_BUCKET'] || '',
  },
  otp: {
    ttlMinutes: parseInt(process.env['OTP_TTL_MINUTES'] || '10', 10),
  },
  sms: {
    provider: (process.env['SMS_PROVIDER'] || 'aws_sns') as 'aws_sns' | 'twilio' | 'africastalking',
    enabled: process.env['SMS_ENABLED'] === 'true',
    senderId: process.env['SMS_SENDER_ID'] || 'QuickBooks',
    aws: {
      region: process.env['AWS_REGION'] || 'af-south-1',
    },
    twilio: {
      accountSid: process.env['TWILIO_ACCOUNT_SID'] || '',
      authToken: process.env['TWILIO_AUTH_TOKEN'] || '',
      phoneNumber: process.env['TWILIO_PHONE_NUMBER'] || '',
    },
    africastalking: {
      username: process.env['AFRICASTALKING_USERNAME'] || '',
      apiKey: process.env['AFRICASTALKING_API_KEY'] || '',
      senderId: process.env['AFRICASTALKING_SENDER_ID'] || process.env['SMS_SENDER_ID'] || 'QuickBooks',
      voicePhone: process.env['AFRICASTALKING_VOICE_PHONE'] || '',
    },
  },
  whatsapp: {
    provider: (process.env['WHATSAPP_PROVIDER'] || 'mock') as 'mock' | 'twilio' | 'africastalking' | 'meta' | 'meta_cloud',
    meta: {
      accessToken: process.env['WHATSAPP_ACCESS_TOKEN'] || '',
      phoneNumberId: process.env['WHATSAPP_PHONE_NUMBER_ID'] || '',
    },
  },
  mobileMoney: {
    parserProvider: (process.env['MOBILE_MONEY_PARSER_PROVIDER'] || 'mock') as 'mock' | 'llm',
  },
  receiptPdf: {
    provider: (process.env['RECEIPT_PDF_PROVIDER'] || 'mock') as 'mock' | 'pdfkit',
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },
  admin: {
    phones: (process.env['ADMIN_PHONES'] || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    emails: (process.env['ADMIN_EMAILS'] || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  },
  oauth: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] || '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
      callbackUrl: process.env['GOOGLE_CALLBACK_URL'] || 'http://localhost:3001/api/v1/auth/google/callback',
    },
    facebook: {
      clientId: process.env['FACEBOOK_APP_ID'] || '',
      clientSecret: process.env['FACEBOOK_APP_SECRET'] || '',
      callbackUrl: process.env['FACEBOOK_CALLBACK_URL'] || 'http://localhost:3001/api/v1/auth/facebook/callback',
    },
    frontendUrl: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    frontendUrls: (process.env['FRONTEND_URL'] || 'http://localhost:3000,http://localhost:3008')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
  },
  features: (() => {
    try {
      const override = process.env['FEATURES_OVERRIDE'];
      if (override) return JSON.parse(override) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }
    return {};
  })(),
};
}
