import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './SmsService';
import { AwsSnsSmsProvider } from './providers/AwsSnsSmsProvider';
import { TwilioSmsProvider } from './providers/TwilioSmsProvider';
import { AfricasTalkingSmsProvider } from './providers/AfricasTalkingSmsProvider';
import { MockWhatsAppProvider } from './providers/MockWhatsAppProvider';
import { MetaCloudWhatsAppProvider } from './providers/MetaCloudWhatsAppProvider';
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
        if (provider === 'meta' || provider === 'meta_cloud') {
          const accessToken = config?.get<string>('whatsapp.meta.accessToken') || process.env['WHATSAPP_ACCESS_TOKEN'];
          const phoneNumberId = config?.get<string>('whatsapp.meta.phoneNumberId') || process.env['WHATSAPP_PHONE_NUMBER_ID'];
          if (accessToken && phoneNumberId) {
            return new MetaCloudWhatsAppProvider(accessToken, phoneNumberId);
          }
          console.warn('[NotificationsModule] WHATSAPP_PROVIDER=meta but WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing; falling back to mock');
        }
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
