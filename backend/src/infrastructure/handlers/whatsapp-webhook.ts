import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../nest/app.module';
import { ChatOrchestrator } from '../../domains/chat/services/ChatOrchestrator';
import { WhatsAppChannel } from '../../domains/chat/providers/WhatsAppChannel';

let appContext: INestApplicationContext | undefined;

async function getContext(): Promise<INestApplicationContext> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  }
  return appContext;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // GET — webhook verification handshake
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters ?? {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];
    const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'] ?? '';

    if (mode === 'subscribe' && token === verifyToken) {
      return { statusCode: 200, body: challenge ?? '' };
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  // POST — incoming message
  try {
    const rawBody = event.body ?? '{}';
    const headers = Object.fromEntries(
      Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v ?? ''])
    );

    const ctx = await getContext();
    const waChannel = ctx.get(WhatsAppChannel);

    // Verify webhook signature
    if (!waChannel.verifyWebhook(headers, rawBody)) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const payload = JSON.parse(rawBody);
    const incoming = waChannel.parseIncoming(payload);

    if (incoming) {
      const orchestrator = ctx.get(ChatOrchestrator);
      await orchestrator.handle(incoming);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('WhatsApp webhook error', err);
    return { statusCode: 200, body: 'OK' }; // always 200 to Meta
  }
}
