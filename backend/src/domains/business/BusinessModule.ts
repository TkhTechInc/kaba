import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { TeamMemberRepository } from '@/domains/access/repositories/TeamMemberRepository';
import { BusinessRepository } from './BusinessRepository';
import { BusinessMemoryRepository } from './BusinessMemoryRepository';
import { BusinessController } from './BusinessController';
import { BranchController } from './BranchController';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';

@Module({
  imports: [AuditModule, forwardRef(() => AccessModule)],
  controllers: [BusinessController, BranchController],
  providers: [
    {
      provide: BusinessRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new BusinessRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: BusinessMemoryRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new BusinessMemoryRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: TeamMemberRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new TeamMemberRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    PermissionGuard,
  ],
  exports: [BusinessRepository, BusinessMemoryRepository],
})
export class BusinessModule {}
