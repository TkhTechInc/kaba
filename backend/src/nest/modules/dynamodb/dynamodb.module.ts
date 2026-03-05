import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export const DYNAMODB_CLIENT = 'DYNAMODB_CLIENT';
export const DYNAMODB_DOC_CLIENT = 'DYNAMODB_DOC_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: DYNAMODB_CLIENT,
      useFactory: (config: ConfigService) => {
        const region = config.get<string>('region') || process.env['AWS_REGION'] || 'af-south-1';
        return new DynamoDBClient({ region });
      },
      inject: [ConfigService],
    },
    {
      provide: DYNAMODB_DOC_CLIENT,
      useFactory: (client: DynamoDBClient) => {
        return DynamoDBDocumentClient.from(client, {
          marshallOptions: {
            convertEmptyValues: true,
            removeUndefinedValues: true,
            convertClassInstanceToMap: true,
          },
        });
      },
      inject: [DYNAMODB_CLIENT],
    },
  ],
  exports: [DYNAMODB_CLIENT, DYNAMODB_DOC_CLIENT],
})
export class DynamoDBModule {}
