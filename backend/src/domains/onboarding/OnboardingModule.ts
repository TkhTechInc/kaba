import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { OnboardingController } from './OnboardingController';
import { OnboardingService } from './OnboardingService';
import { OnboardingAIService } from './OnboardingAIService';
import { OnboardingRepository } from './repositories/OnboardingRepository';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { AIModule } from '@/nest/modules/ai/ai.module';

@Module({
  imports: [BusinessModule, AccessModule, AIModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    OnboardingAIService,
    {
      provide: OnboardingRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new OnboardingRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [OnboardingService],
})
export class OnboardingModule {}
