import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../nest/app.module';
import { ChatOrchestrator } from '../../domains/chat/services/ChatOrchestrator';
import { TelegramChannel } from '../../domains/chat/providers/TelegramChannel';

let appContext: INestApplicationContext | undefined;

async function getContext(): Promise<INestApplicationContext> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  }
  return appContext;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const rawBody = event.body ?? '{}';
    const headers = Object.fromEntries(
      Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v ?? ''])
    );

    const ctx = await getContext();
    const tgChannel = ctx.get(TelegramChannel);

    if (!tgChannel.verifyWebhook(headers, rawBody)) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const payload = JSON.parse(rawBody);
    const incoming = tgChannel.parseIncoming(payload);

    if (incoming) {
      const orchestrator = ctx.get(ChatOrchestrator);
      await orchestrator.handle(incoming);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Telegram webhook error', err);
    return { statusCode: 200, body: 'OK' }; // always 200 to Telegram
  }
}
