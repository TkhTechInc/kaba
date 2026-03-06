import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { VerificationModule } from '@/domains/verification/VerificationModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { AuditModule } from '@/domains/audit/AuditModule';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { InvitationRepository } from './repositories/InvitationRepository';
import { AccessService } from './AccessService';
import { InvitationService } from './InvitationService';
import { AccessController } from './AccessController';
import { InvitationController } from './InvitationController';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';

@Module({
  imports: [forwardRef(() => BusinessModule), VerificationModule, NotificationsModule, AuditModule],
  controllers: [AccessController, InvitationController],
  providers: [
    {
      provide: OrganizationRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new OrganizationRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: TeamMemberRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new TeamMemberRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: InvitationRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new InvitationRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    AccessService,
    InvitationService,
    PermissionGuard,
  ],
  exports: [AccessService, InvitationService, PermissionGuard, TeamMemberRepository],
})
export class AccessModule {}
