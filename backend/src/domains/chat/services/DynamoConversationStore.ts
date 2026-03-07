import { Inject, Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { IConversationStore, ChatSession } from '../interfaces/IConversationStore';

const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class DynamoConversationStore implements IConversationStore {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT) private readonly client: DynamoDBDocumentClient,
    config: ConfigService,
  ) {
    this.tableName =
      process.env['CHAT_SESSIONS_TABLE'] ??
      config.get<string>('dynamodb.tableName') ??
      'kaba-dev';
  }

  async get(sessionId: string): Promise<ChatSession | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `CHAT#${sessionId}`, sk: 'SESSION' },
      }),
    );
    if (!res.Item) return null;
    const { pk: _pk, sk: _sk, ttl: _ttl, ...session } = res.Item;
    return session as ChatSession;
  }

  async save(session: ChatSession): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `CHAT#${session.id}`, sk: 'SESSION', ttl, ...session },
      }),
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `CHAT#${sessionId}`, sk: 'SESSION' },
      }),
    );
  }
}
