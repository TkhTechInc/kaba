import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { AppModule } from '../../nest/app.module';
import { AgentOrchestrator } from '../../domains/mcp/AgentOrchestrator';
import { TelegramChannel } from '../../domains/chat/providers/TelegramChannel';
import { ChatUserResolver } from '../../domains/chat/services/ChatUserResolver';
import { DynamoConversationStore } from '../../domains/chat/services/DynamoConversationStore';
import { BusinessRepository } from '../../domains/business/BusinessRepository';
import { AI_SPEECH_TO_TEXT } from '../../nest/modules/ai/ai.tokens';
import type { ISpeechToText } from '../../domains/ai/ISpeechToText';

let appContext: INestApplicationContext | undefined;

async function getContext(): Promise<INestApplicationContext> {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  }
  return appContext;
}

const REGISTRATION_PROMPT =
  'Welcome to Kaba! Your account is not linked to this chat.\n\n' +
  'To get started:\n' +
  '1. Create an account at app.kaba.dev\n' +
  '2. Reply: LINK <your email>\n' +
  '   (If you have multiple businesses: LINK <email> <businessId>)\n\n' +
  'Example: LINK amara@gmail.com';

const LINK_COMMAND = /^link\s+(\S+@\S+\.\S+)(?:\s+(\S+))?$/i;

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

    const payload = JSON.parse(rawBody) as unknown;
    const incoming = tgChannel.parseIncoming(payload);

    if (!incoming) {
      return { statusCode: 200, body: 'OK' };
    }

    const conversationStore = ctx.get(DynamoConversationStore);
    const userResolver = ctx.get(ChatUserResolver);
    const sessionId = `${incoming.channelUserId}:${incoming.channel}`;

    let session = await conversationStore.get(sessionId);

    // Auto-resolve on first message (Telegram: no phone, always null)
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

      if (match) {
        const email = match[1];
        const businessId = match[2];
        const resolved = await userResolver.resolveByEmail(email, businessId);
        if (resolved) {
          session.businessId = resolved.businessId;
          session.userId = resolved.userId;
          session.linked = true;
          await conversationStore.save(session);
          reply =
            'Linked! Your Kaba account is now connected.\n\n' +
            'You can now ask me:\n' +
            '• "Check my balance"\n' +
            '• "I sold 3 bags of rice for 45,000"\n' +
            '• "Who owes me money?"\n' +
            '• "Send reminder to Moussa"\n' +
            '• "My daily summary"';
        } else {
          reply = `No Kaba account found for ${email}.\n\nSign up at app.kaba.dev, then try: LINK ${email}`;
        }
      } else {
        reply = REGISTRATION_PROMPT;
      }

      await tgChannel.send({ channelUserId: incoming.channelUserId, text: reply });
      return { statusCode: 200, body: 'OK' };
    }

    // Resolve message: text or transcribe voice note
    let messageText = incoming.text ?? '';
    if (!messageText && incoming.audioUrl?.startsWith('telegram-voice:')) {
      try {
        const fileId = incoming.audioUrl.replace(/^telegram-voice:/, '');
        const audioBuffer = await tgChannel.fetchVoiceToBuffer(fileId);
        const speechToText = ctx.get(AI_SPEECH_TO_TEXT) as ISpeechToText;
        const { text } = await speechToText.transcribe(audioBuffer);
        messageText = text?.trim() || '';
      } catch (err) {
        console.error('Telegram voice transcription failed', err);
        await tgChannel.send({
          channelUserId: incoming.channelUserId,
          text: 'Sorry, I could not understand the voice message. Please try typing your message.',
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
      channelName: 'telegram',
    });

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Telegram webhook error', err);
    return { statusCode: 200, body: 'OK' }; // always 200 to Telegram
  }
}
