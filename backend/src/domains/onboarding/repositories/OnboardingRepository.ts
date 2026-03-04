import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { DatabaseError } from '@/shared/errors/DomainError';
import type {
  OnboardingState,
  OnboardingStep,
  OnboardingAnswers,
} from '../models/OnboardingState';

const SK_ONBOARDING = 'ONBOARDING';

export class OnboardingRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getByBusinessId(businessId: string): Promise<OnboardingState | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { pk: businessId, sk: SK_ONBOARDING },
        }),
      );
      if (!result.Item) return null;
      return this.mapFromDynamoDB(result.Item);
    } catch (e) {
      throw new DatabaseError('Get onboarding state failed', e);
    }
  }

  async upsert(state: OnboardingState): Promise<OnboardingState> {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.mapToDynamoDB(state),
        }),
      );
      return state;
    } catch (e) {
      throw new DatabaseError('Upsert onboarding state failed', e);
    }
  }

  private mapToDynamoDB(s: OnboardingState): Record<string, unknown> {
    return {
      pk: s.businessId,
      sk: SK_ONBOARDING,
      entityType: 'ONBOARDING',
      businessId: s.businessId,
      userId: s.userId,
      step: s.step,
      completedSteps: s.completedSteps,
      answers: s.answers,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    };
  }

  private mapFromDynamoDB(item: Record<string, unknown>): OnboardingState {
    return {
      businessId: String(item.businessId ?? item.pk ?? ''),
      userId: String(item.userId ?? ''),
      step: (item.step as OnboardingStep) ?? 'businessName',
      completedSteps: (item.completedSteps as OnboardingStep[]) ?? [],
      answers: (item.answers as OnboardingAnswers) ?? {},
      startedAt: String(item.startedAt ?? ''),
      completedAt: item.completedAt != null ? String(item.completedAt) : undefined,
    };
  }
}
