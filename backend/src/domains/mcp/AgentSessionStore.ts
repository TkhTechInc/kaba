import { Inject, Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import type { IAgentSession } from './interfaces/IAgentSession';

const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AgentSessionStore {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT) private readonly client: DynamoDBDocumentClient,
    config: ConfigService,
  ) {
    this.tableName =
      process.env['AGENT_SESSIONS_TABLE'] ??
      config.get<string>('dynamodb.agentSessionsTable') ??
      'Kaba-AgentSessions-dev';
  }

  async get(sessionId: string): Promise<IAgentSession | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `AGENT#${sessionId}`, sk: 'SESSION' },
      }),
    );
    if (!res.Item) return null;
    const { pk: _pk, sk: _sk, ttl: _ttl, ...session } = res.Item;
    return session as IAgentSession;
  }

  async save(session: IAgentSession): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const { ttl: _sessionTtl, ...sessionData } = session;
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `AGENT#${session.sessionId}`, sk: 'SESSION', ttl, ...sessionData },
      }),
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `AGENT#${sessionId}`, sk: 'SESSION' },
      }),
    );
  }
}
