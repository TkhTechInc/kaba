#!/usr/bin/env node

const esbuild = require('esbuild');
const { esbuildDecorators } = require('@anatine/esbuild-decorators');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiLambdaDir = path.join(rootDir, 'dist/api-lambda');
const recurringLambdaDir = path.join(rootDir, 'dist/recurring-invoice-lambda');
const paymentReminderLambdaDir = path.join(rootDir, 'dist/payment-reminder-lambda');
const dailySummaryLambdaDir = path.join(rootDir, 'dist/daily-summary-lambda');
const paymentEventLambdaDir = path.join(rootDir, 'dist/payment-event-lambda');
const whatsappWebhookDir = path.join(rootDir, 'dist/lambda/whatsapp-webhook');
const telegramWebhookDir = path.join(rootDir, 'dist/lambda/telegram-webhook');
[apiLambdaDir, recurringLambdaDir, paymentReminderLambdaDir, dailySummaryLambdaDir, paymentEventLambdaDir, whatsappWebhookDir, telegramWebhookDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Remove leftover trace files from previous debug builds
if (fs.existsSync(apiLambdaDir)) {
  const files = fs.readdirSync(apiLambdaDir);
  for (const f of files) {
    if (f.startsWith('handler-trace') && f.endsWith('.js')) {
      fs.unlinkSync(path.join(apiLambdaDir, f));
    }
  }
}

console.log('Bundling Nest API Lambda...');

const externals = [
  'aws-sdk',
  '@aws-sdk/*',
  'aws-lambda',
  'aws-lambda/*',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  'class-transformer/storage',
  'mock-aws-s3',
  'nock',
  '@anthropic-ai/sdk',
  'openai',
  '@google/generative-ai',
];

esbuild
  .build({
    entryPoints: [path.join(rootDir, 'src/nest/lambda.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    tsconfig: path.join(rootDir, 'tsconfig.json'),
    outfile: path.join(rootDir, 'dist/api-lambda/handler.js'),
    external: externals,
    plugins: [
      esbuildDecorators({
        tsconfig: path.join(rootDir, 'tsconfig.json'),
        cwd: rootDir,
      }),
    ],
  })
  .then(() => {
    console.log('Nest API Lambda bundled: dist/api-lambda/handler.js');
    return esbuild.build({
      entryPoints: [
        path.join(rootDir, 'src/infrastructure/handlers/recurring-invoice.ts'),
      ],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/recurring-invoice-lambda/handler.js'),
      external: externals,
    });
  })
  .then(() => {
    console.log('Recurring invoice Lambda bundled: dist/recurring-invoice-lambda/handler.js');
    return esbuild.build({
      entryPoints: [path.join(rootDir, 'src/infrastructure/handlers/payment-reminder.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/payment-reminder-lambda/handler.js'),
      external: externals,
    });
  })
  .then(() => {
    console.log('Payment reminder Lambda bundled: dist/payment-reminder-lambda/handler.js');
    return esbuild.build({
      entryPoints: [path.join(rootDir, 'src/infrastructure/handlers/daily-summary.ts')],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/daily-summary-lambda/handler.js'),
      external: externals,
    });
  })
  .then(() => {
    console.log('Daily summary Lambda bundled: dist/daily-summary-lambda/handler.js');
    return esbuild.build({
      entryPoints: [
        path.join(rootDir, 'src/infrastructure/handlers/payment-event.ts'),
      ],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/payment-event-lambda/handler.js'),
      external: externals,
    });
  })
  .then(() => {
    console.log('Payment event Lambda bundled: dist/payment-event-lambda/handler.js');
    return esbuild.build({
      entryPoints: [
        path.join(rootDir, 'src/infrastructure/handlers/whatsapp-webhook.ts'),
      ],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/lambda/whatsapp-webhook/handler.js'),
      external: externals,
      plugins: [
        esbuildDecorators({
          tsconfig: path.join(rootDir, 'tsconfig.json'),
          cwd: rootDir,
        }),
      ],
    });
  })
  .then(() => {
    console.log('WhatsApp webhook Lambda bundled: dist/lambda/whatsapp-webhook/handler.js');
    return esbuild.build({
      entryPoints: [
        path.join(rootDir, 'src/infrastructure/handlers/telegram-webhook.ts'),
      ],
      bundle: true,
      platform: 'node',
      target: 'node20',
      tsconfig: path.join(rootDir, 'tsconfig.json'),
      outfile: path.join(rootDir, 'dist/lambda/telegram-webhook/handler.js'),
      external: externals,
      plugins: [
        esbuildDecorators({
          tsconfig: path.join(rootDir, 'tsconfig.json'),
          cwd: rootDir,
        }),
      ],
    });
  })
  .then(() => {
    console.log('Telegram webhook Lambda bundled: dist/lambda/telegram-webhook/handler.js');
  })
  .catch((err) => {
    console.error('Bundle failed:', err.message);
    process.exit(1);
  });
