import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '@/nest/common/decorators/auth.decorator';
import { UssdService } from './UssdService';

/**
 * Africa's Talking USSD API callback.
 * Configure USSD_CALLBACK_URL in Africa's Talking dashboard to point here.
 * Receives form-urlencoded: sessionId, serviceCode, phoneNumber, text.
 * Returns text/plain with CON (continue) or END (terminate) response.
 */
@Controller('api/v1/ussd')
export class UssdController {
  private readonly logger = new Logger(UssdController.name);

  constructor(private readonly ussdService: UssdService) {}

  @Post('callback')
  @Public()
  async handleCallback(
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const sessionId = body.sessionId ?? '';
    const serviceCode = body.serviceCode ?? '';
    const phoneNumber = body.phoneNumber ?? '';
    const text = body.text;

    if (!sessionId || !serviceCode || !phoneNumber) {
      res.type('text/plain').send('END Invalid request. Missing required fields.');
      return;
    }

    const expectedKey = process.env['USSD_API_KEY'];
    if (expectedKey) {
      const incomingKey = (body as any)['apiKey'] ?? '';
      if (incomingKey !== expectedKey) {
        res.type('text/plain').send('END Unauthorized request.');
        return;
      }
    } else {
      this.logger.warn('USSD_API_KEY is not set — USSD endpoint is unauthenticated');
    }

    const response = await this.ussdService.handleSession(
      sessionId,
      serviceCode,
      phoneNumber,
      text,
    );

    res.type('text/plain').send(response);
  }
}
