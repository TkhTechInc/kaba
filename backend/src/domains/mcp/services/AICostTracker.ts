import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AI_CONFIG } from '@/config/constants';
import { AIQuotaExceededError } from '../errors/McpErrors';
import type { Tier } from '@/domains/features/feature.types';

interface AIUsageRecord {
  userId: string;
  month: string; // YYYY-MM
  totalTokens: number;
  totalCost: number;
  calls: number;
  lastUpdated: string;
}

@Injectable()
export class AICostTracker {
  private readonly logger = new Logger(AICostTracker.name);

  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Check if user has quota remaining for AI operations
   */
  async checkQuota(userId: string, tier: Tier): Promise<boolean> {
    const usage = await this.getUsage(userId);
    const limit = AI_CONFIG.TOKEN_LIMITS[tier] ?? AI_CONFIG.TOKEN_LIMITS.starter;

    if (usage.totalTokens >= limit) {
      this.logger.warn('AI quota exceeded', { userId, tier, usage, limit });
      return false;
    }

    return true;
  }

  /**
   * Record AI usage and throw if quota exceeded
   */
  async recordUsage(
    userId: string,
    tier: Tier,
    tokens: number,
    cost: number,
    operation: string,
  ): Promise<void> {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${userId}`,
            sk: `AI_USAGE#${month}`,
          },
          UpdateExpression:
            'SET totalTokens = if_not_exists(totalTokens, :zero) + :tokens, ' +
            'totalCost = if_not_exists(totalCost, :zero) + :cost, ' +
            'calls = if_not_exists(calls, :zero) + :one, ' +
            'lastUpdated = :now, ' +
            '#tier = :tier',
          ExpressionAttributeNames: {
            '#tier': 'tier',
          },
          ExpressionAttributeValues: {
            ':tokens': tokens,
            ':cost': cost,
            ':one': 1,
            ':zero': 0,
            ':now': new Date().toISOString(),
            ':tier': tier,
          },
          ReturnValues: 'ALL_NEW',
        }),
      );

      const newTotal = result.Attributes?.totalTokens ?? 0;
      const limit = AI_CONFIG.TOKEN_LIMITS[tier] ?? AI_CONFIG.TOKEN_LIMITS.starter;

      this.logger.debug('AI usage recorded', {
        userId,
        operation,
        tokens,
        cost,
        newTotal,
        limit,
      });

      // Check if we've exceeded quota after recording
      if (newTotal > limit) {
        throw new AIQuotaExceededError(newTotal, limit, tier);
      }
    } catch (err) {
      if (err instanceof AIQuotaExceededError) {
        throw err;
      }
      this.logger.error('Failed to record AI usage', { userId, tokens, cost, err });
      // Don't fail the operation if tracking fails
    }
  }

  /**
   * Get current usage for user this month
   */
  async getUsage(userId: string): Promise<AIUsageRecord> {
    const month = new Date().toISOString().slice(0, 7);

    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${userId}`,
            sk: `AI_USAGE#${month}`,
          },
        }),
      );

      if (!result.Item) {
        return {
          userId,
          month,
          totalTokens: 0,
          totalCost: 0,
          calls: 0,
          lastUpdated: new Date().toISOString(),
        };
      }

      return {
        userId,
        month,
        totalTokens: result.Item.totalTokens ?? 0,
        totalCost: result.Item.totalCost ?? 0,
        calls: result.Item.calls ?? 0,
        lastUpdated: result.Item.lastUpdated,
      };
    } catch (err) {
      this.logger.error('Failed to get AI usage', { userId, err });
      return {
        userId,
        month,
        totalTokens: 0,
        totalCost: 0,
        calls: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get usage summary for admin dashboard
   */
  async getUsageSummary(userId: string, months: number = 6): Promise<AIUsageRecord[]> {
    const summaries: AIUsageRecord[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toISOString().slice(0, 7);

      try {
        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: {
              pk: `USER#${userId}`,
              sk: `AI_USAGE#${month}`,
            },
          }),
        );

        summaries.push({
          userId,
          month,
          totalTokens: result.Item?.totalTokens ?? 0,
          totalCost: result.Item?.totalCost ?? 0,
          calls: result.Item?.calls ?? 0,
          lastUpdated: result.Item?.lastUpdated ?? '',
        });
      } catch (err) {
        this.logger.error('Failed to get usage for month', { userId, month, err });
      }
    }

    return summaries;
  }
}
