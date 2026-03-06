import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyRepository } from './IdempotencyRepository';
import { IdempotencyInterceptor } from './IdempotencyInterceptor';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';

@Global()
@Module({
  providers: [
    {
      provide: IdempotencyRepository,
      useFactory: (docClient: import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.idempotencyTable') || 'Kaba-Idempotency-dev';
        return new IdempotencyRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyRepository],
})
export class IdempotencyModule {}
