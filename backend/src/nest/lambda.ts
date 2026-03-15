import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import serverlessExpress from '@codegenie/serverless-express';
import { AppModule } from './app.module';
import { Callback, Context, Handler } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ConfigService } from '@nestjs/config';

let server: Handler;

async function ensureJwtSecret(): Promise<void> {
  if (process.env['JWT_SECRET']) return;
  const secretName = process.env['JWT_SECRET_SECRET_NAME'];
  if (!secretName) return;
  const client = new SecretsManagerClient({ region: process.env['AWS_REGION'] || 'af-south-1' });
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  const raw = res.SecretString;
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as { jwt_secret?: string };
    if (data.jwt_secret) process.env['JWT_SECRET'] = data.jwt_secret;
  } catch {
    // ignore parse errors
  }
}

async function ensureOpenRouterApiKey(): Promise<void> {
  if (process.env['OPENROUTER_API_KEY']) return;
  const secretName = process.env['OPENROUTER_API_KEY_SECRET_NAME'];
  if (!secretName) return;
  try {
    const client = new SecretsManagerClient({ region: process.env['AWS_REGION'] || 'af-south-1' });
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const raw = res.SecretString;
    if (!raw) return;
    const data = JSON.parse(raw) as { openrouter_api_key?: string };
    if (data.openrouter_api_key) process.env['OPENROUTER_API_KEY'] = data.openrouter_api_key;
  } catch {
    // Secret may not exist yet; AI features will use mock
  }
}

async function ensureGoogleOAuth(): Promise<void> {
  if (process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']) return;
  const secretName = process.env['GOOGLE_OAUTH_SECRET_NAME'];
  if (!secretName) return;
  try {
    const client = new SecretsManagerClient({ region: process.env['AWS_REGION'] || 'af-south-1' });
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const raw = res.SecretString;
    if (!raw) return;
    const data = JSON.parse(raw) as { client_id?: string; client_secret?: string } | Record<string, string>;
    const clientId = data.client_id ?? (data as Record<string, string>)['clientId'];
    const clientSecret = data.client_secret ?? (data as Record<string, string>)['clientSecret'];
    if (clientId) process.env['GOOGLE_CLIENT_ID'] = clientId;
    if (clientSecret) process.env['GOOGLE_CLIENT_SECRET'] = clientSecret;
  } catch {
    // Secret may not exist; Google OAuth will be disabled (returns 503)
  }
}

async function bootstrap(): Promise<Handler> {
  try {
    await ensureJwtSecret();
    await ensureOpenRouterApiKey();
    await ensureGoogleOAuth();
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false });

    app.set('trust proxy', 1);
    app.use(helmet({ contentSecurityPolicy: false }));

    let corsOrigins: string[] | undefined;
    try {
      const configService = app.get(ConfigService);
      corsOrigins = configService?.get<string[]>('cors.origins');
    } catch {
      corsOrigins = (process.env['CORS_ORIGINS'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    const nodeEnv = process.env['NODE_ENV'] || 'dev';
    if (!corsOrigins?.length && nodeEnv === 'production') {
      throw new Error('CORS_ORIGINS must be set in production');
    }
    if (!corsOrigins?.length) corsOrigins = undefined;
    app.enableCors({
      origin: corsOrigins?.length ? corsOrigins : (nodeEnv === 'production' ? [] : true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Idempotency-Key'],
    });

    app.useBodyParser('json', { limit: '1mb' });
    app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

    await app.init();

    const expressApp = app.getHttpAdapter().getInstance();
    const srv = serverlessExpress({ app: expressApp });
    return srv;
  } catch (err) {
    console.error('[boot] FAILED:', err);
    throw err;
  }
}

export const handler: Handler = async (event: any, context: Context, callback: Callback) => {
  // Strip API Gateway stage from path (e.g. /dev/api/v1/... -> /api/v1/...)
  if (event.path) {
    event.path = event.path.replace(/^\/(dev|staging|prod)/, '') || '/';
  }
  // When using {proxy+}, serverless-express prefers pathParameters.proxy over event.path.
  // pathParameters.proxy only contains the segment after /api/v1/ (e.g. "auth/send-otp"),
  // but NestJS expects the full path /api/v1/auth/send-otp. Clear proxy so it falls back to event.path.
  if (event.pathParameters?.proxy != null) {
    delete event.pathParameters.proxy;
  }
  if (!server) {
    server = await bootstrap();
  }
  return server(event, context, callback);
};
