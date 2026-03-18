import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../nest/app.module';
import { AgentOrchestrator } from '../../domains/mcp/AgentOrchestrator';
import { WhatsAppChannel } from '../../domains/chat/providers/WhatsAppChannel';
import { ChatUserResolver } from '../../domains/chat/services/ChatUserResolver';
import { DynamoConversationStore } from '../../domains/chat/services/DynamoConversationStore';
import { BusinessRepository } from '../../domains/business/BusinessRepository';
import { AI_SPEECH_TO_TEXT } from '../../nest/modules/ai/ai.tokens';
import type { ISpeechToText } from '../../domains/ai/ISpeechToText';
import { getMessages, formatMessage } from '../../domains/i18n/messages';

let appContext: INestApplicationContext | undefined;

async function getContext(): Promise<INestApplicationContext> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  }
  return appContext;
}

// Default locale for West Africa (French)
const DEFAULT_LOCALE = 'fr';

function getRegistrationPrompt(locale: string = DEFAULT_LOCALE): string {
  const msg = getMessages(locale);
  return `${msg.whatsapp.welcome}\n\n${msg.whatsapp.linkPrompt}`;
}

const LINK_COMMAND = /^link\s+(\S+@\S+\.\S+)(?:\s+(\S+))?$/i;

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

    if (!waChannel.verifyWebhook(headers, rawBody)) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const payload = JSON.parse(rawBody) as unknown;
    const incoming = waChannel.parseIncoming(payload);

    if (!incoming) {
      return { statusCode: 200, body: 'OK' };
    }

    const conversationStore = ctx.get(DynamoConversationStore);
    const userResolver = ctx.get(ChatUserResolver);
    const sessionId = `${incoming.channelUserId}:${incoming.channel}`;

    let session = await conversationStore.get(sessionId);

    // Auto-resolve on first message
    if (!session) {
      const resolved = await userResolver.resolveByChannelUserId(incoming.channelUserId, incoming.channel);
      session = {
        id: sessionId,
        businessId: resolved?.businessId ?? '',
        userId: resolved?.userId ?? '',
        channel: incoming.channel,
        channelUserId: incoming.channelUserId,
        history: [],
        linked: !!resolved,
        updatedAt: new Date().toISOString(),
      };
      await conversationStore.save(session);
    }

    // Handle account linking flow
    if (!session.linked) {
      const text = (incoming.text ?? '').trim();
      const match = text.match(LINK_COMMAND);
      let reply: string;
      const locale = DEFAULT_LOCALE; // TODO: detect user language or store preference
      const msg = getMessages(locale);

      if (match) {
        const email = match[1];
        const businessId = match[2];
        const resolved = await userResolver.resolveByEmail(email, businessId);
        if (resolved) {
          session.businessId = resolved.businessId;
          session.userId = resolved.userId;
          session.linked = true;
          await conversationStore.save(session);
          reply = msg.whatsapp.linkSuccess;
        } else {
          reply = formatMessage(msg.whatsapp.linkFailed, { email });
        }
      } else {
        reply = getRegistrationPrompt(locale);
      }

      await waChannel.send({ channelUserId: incoming.channelUserId, text: reply });
      return { statusCode: 200, body: 'OK' };
    }

    // Resolve message: text or transcribe voice note
    let messageText = incoming.text ?? '';
    if (!messageText && incoming.audioUrl?.startsWith('whatsapp-media:')) {
      try {
        const mediaId = incoming.audioUrl.replace(/^whatsapp-media:/, '');
        const audioBuffer = await waChannel.fetchMediaToBuffer(mediaId);
        const speechToText = ctx.get(AI_SPEECH_TO_TEXT) as ISpeechToText;
        const { text } = await speechToText.transcribe(audioBuffer);
        messageText = text?.trim() || '';
      } catch (err) {
        console.error('WhatsApp voice transcription failed', err);
        const locale = DEFAULT_LOCALE;
        const msg = getMessages(locale);
        await waChannel.send({
          channelUserId: incoming.channelUserId,
          text: msg.whatsapp.voiceTranscriptionFailed,
        });
        return { statusCode: 200, body: 'OK' };
      }
    }
    if (!messageText) return { statusCode: 200, body: 'OK' };

    // Linked — route through AgentOrchestrator
    const businessRepo = ctx.get(BusinessRepository);
    const business = await businessRepo.getOrCreate(session.businessId, 'free');
    const agentOrchestrator = ctx.get(AgentOrchestrator);
    await agentOrchestrator.chat({
      sessionId,
      message: messageText,
      businessId: session.businessId,
      userId: session.userId,
      tier: business.tier,
      scope: 'business',
      channelUserId: incoming.channelUserId,
      channelName: 'whatsapp',
    });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('WhatsApp webhook error', err);
    return { statusCode: 200, body: 'OK' }; // always 200 to Meta
  }
}
