import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './SmsService';
import { AwsSnsSmsProvider } from './providers/AwsSnsSmsProvider';
import { TwilioSmsProvider } from './providers/TwilioSmsProvider';
import { AfricasTalkingSmsProvider } from './providers/AfricasTalkingSmsProvider';
import { MockWhatsAppProvider } from './providers/MockWhatsAppProvider';
import { WHATSAPP_PROVIDER } from './notification.tokens';
import type { IWhatsAppProvider } from './IWhatsAppProvider';

@Module({
  providers: [
    SmsService,
    AwsSnsSmsProvider,
    TwilioSmsProvider,
    AfricasTalkingSmsProvider,
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (config: ConfigService): IWhatsAppProvider => {
        const provider = config?.get<string>('whatsapp.provider') || process.env['WHATSAPP_PROVIDER'] || 'mock';
        if (provider === 'twilio' || provider === 'africastalking') {
          // TODO: Agent D - add TwilioWhatsAppProvider, AfricasTalkingWhatsAppProvider
          return new MockWhatsAppProvider();
        }
        return new MockWhatsAppProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SmsService, WHATSAPP_PROVIDER],
})
export class NotificationsModule {}
