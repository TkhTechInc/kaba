import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../modules/dynamodb/dynamodb.module';
import { AuthController } from './auth.controller';
import { UserController } from './UserController';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/UserRepository';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { GoogleStrategy } from '../../common/strategies/google.strategy';
import { FacebookStrategy } from '../../common/strategies/facebook.strategy';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { OtpModule } from '@/domains/otp/OtpModule';
import { VerificationModule } from '@/domains/verification/VerificationModule';
import { VoiceModule } from '@/domains/voice/VoiceModule';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret')!,
        signOptions: { expiresIn: (config.get<string>('jwt.expiresIn') || '24h') as '24h' },
      }),
    }),
    BusinessModule,
    AccessModule,
    NotificationsModule,
    OtpModule,
    VerificationModule,
    VoiceModule,
  ],
  controllers: [AuthController, UserController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: UserRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.usersTable') ?? 'QuickBooks-UsersService-dev-users';
        return new UserRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    GoogleStrategy,
    FacebookStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
