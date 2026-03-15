import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';
// Load .env from backend/ - try __dirname first, then cwd (for different run contexts)
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    config({ path: p });
    break;
  }
}
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { initSentry, flushSentry } from '@/shared/sentry';

// Initialize Sentry before app creation
initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false }));

  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('cors.origins') ?? [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  const isProd = configService.get<string>('environment') === 'production';
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : (isProd ? [] : ['http://localhost:3000', 'http://localhost:3001']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Capture raw body bytes before JSON parsing — required for webhook HMAC signature verification.
  app.use(
    '/api/v1/payments/webhook',
    (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
      let data = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => { data += chunk; });
      req.on('end', () => { (req as any).rawBody = data; next(); });
    },
  );
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  const port = process.env['PORT'] || 3001;
  await app.listen(port);

  console.log(`🚀 NestJS server running on http://localhost:${port}`);
  console.log(`💚 Health check:  http://localhost:${port}/health`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, flushing Sentry and closing app...');
    await flushSentry();
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch(async (error) => {
  console.error('Failed to bootstrap application:', error);
  await flushSentry();
  process.exit(1);
});
