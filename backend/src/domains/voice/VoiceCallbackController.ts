import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Auth, Public } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { OtpRepository } from '@/domains/otp/OtpRepository';
import { VoiceOtpService } from './VoiceOtpService';
import { VoiceCommandService } from './VoiceCommandService';
import { VoiceCommandDto } from './dto/voice-command.dto';

/**
 * Handles Africa's Talking Voice API callbacks.
 * Configure this URL in your Africa's Talking dashboard as the "Answer URL" for outbound calls.
 * When a voice OTP call is answered, AT POSTs here; we return XML with TTS of the OTP code.
 */
@Controller('api/v1/voice')
export class VoiceCallbackController {
  constructor(
    private readonly otpRepo: OtpRepository,
    private readonly voiceOtpService: VoiceOtpService,
    private readonly voiceCommandService: VoiceCommandService,
  ) {}

  @Post('command')
  @Auth()
  async handleCommand(
    @Body() dto: VoiceCommandDto,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) {
      return { success: false, message: 'Authentication required' };
    }
    return this.voiceCommandService.processAndSend(
      dto.businessId,
      userId,
      dto.phone,
      dto.text,
    );
  }

  @Post('callback')
  @Public()
  async handleCallback(
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    // Africa's Talking sends: destinationNumber (user we called), callerNumber, sessionId, etc.
    const destinationNumber = body.destinationNumber || body.destination || body.to;
    const locale = (body.locale === 'fr' ? 'fr' : 'en') as 'en' | 'fr';

    if (!destinationNumber) {
      res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not identify your number.</Say></Response>',
      );
      return;
    }

    const record = await this.otpRepo.getLatest(destinationNumber);
    if (!record || new Date(record.expiresAt) < new Date()) {
      res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Your code has expired. Please request a new one.</Say></Response>',
      );
      return;
    }

    const message = this.voiceOtpService.getOtpMessage(record.code, locale);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${this.escapeXml(message)}</Say></Response>`;
    res.type('application/xml').send(xml);
  }

  private escapeXml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
