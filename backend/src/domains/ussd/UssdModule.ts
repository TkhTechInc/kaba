import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import { AccessModule } from '@/domains/access/AccessModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { UssdController } from './UssdController';
import { UssdService } from './UssdService';

@Module({
  imports: [AccessModule, LedgerModule, DebtModule],
  controllers: [UssdController],
  providers: [
    UssdService,
    {
      provide: UserRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.usersTable') ??
          'QuickBooks-UsersService-dev-users';
        return new UserRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [UssdService],
})
export class UssdModule {}
