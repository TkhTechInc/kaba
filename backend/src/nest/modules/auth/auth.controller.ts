import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/auth.decorator';
import { AuthService } from './auth.service';
import { VoiceOtpService } from '@/domains/voice/VoiceOtpService';
import { LoginDto } from './dto/login.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { SignUpDto } from './dto/signup.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/v1/auth')
@Public()
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly voiceOtpService: VoiceOtpService,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.loginWithPhone(dto.phone, dto.otp, dto.password);
  }

  @Post('login/email')
  async loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email, dto.password);
  }

  @Post('sign-up/request')
  async signUpRequest(@Body() body: { email: string }) {
    if (!body.email?.trim()) {
      throw new BadRequestException('email is required');
    }
    return this.authService.signUpRequest(body.email.trim());
  }

  @Post('sign-up/verify')
  async signUpVerify(@Body() body: { email: string; code: string; password: string }) {
    if (!body.email?.trim() || !body.code?.trim() || !body.password?.trim()) {
      throw new BadRequestException('email, code, and password are required');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    return this.authService.signUpVerify(body.email.trim(), body.code.trim(), body.password);
  }

  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto.email, dto.password);
  }

  @Post('send-otp')
  async sendOtp(@Body() body: { phone: string }) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('invite/request-otp')
  async inviteRequestOtp(@Body() body: { token: string }) {
    if (!body.token?.trim()) {
      throw new BadRequestException('token is required');
    }
    return this.authService.inviteRequestOtp(body.token.trim());
  }

  @Post('invite/verify')
  async inviteVerify(@Body() body: { token: string; emailOrPhone: string; code: string; password: string }) {
    if (!body.token?.trim() || !body.emailOrPhone?.trim() || !body.code?.trim() || !body.password?.trim()) {
      throw new BadRequestException('token, emailOrPhone, code, and password are required');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    return this.authService.inviteVerify({
      token: body.token.trim(),
      emailOrPhone: body.emailOrPhone.trim(),
      code: body.code.trim(),
      password: body.password,
    });
  }

  @Post('send-voice-otp')
  async sendVoiceOtp(@Body() body: { phone: string; locale?: 'en' | 'fr' }) {
    return this.voiceOtpService.initiateCall(body.phone, body.locale || 'en');
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { id: string; email?: string; providerId: string; name?: string; picture?: string };
    const result = await this.authService.loginOrCreateOAuth(
      'google',
      user.providerId,
      user.email,
      user.name,
      user.picture,
    );
    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') || process.env['FRONTEND_URL'] || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {
    // Guard redirects to Facebook
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { id: string; email?: string; providerId: string; name?: string; picture?: string };
    const result = await this.authService.loginOrCreateOAuth(
      'facebook',
      user.providerId,
      user.email,
      user.name,
      user.picture,
    );
    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') || process.env['FRONTEND_URL'] || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }
}
