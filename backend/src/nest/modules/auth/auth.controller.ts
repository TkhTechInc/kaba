import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public, Auth } from '../../common/decorators/auth.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { VoiceOtpService } from '@/domains/voice/VoiceOtpService';
import { LoginDto } from './dto/login.dto';
import { LoginEmailDto } from './dto/login-email.dto';
import { SignUpDto } from './dto/signup.dto';
import { AuthGuard } from '@nestjs/passport';
import { AUTH_COOKIE_NAME } from '../../common/strategies/jwt.strategy';
import { GoogleOAuthConfiguredGuard } from '../../common/guards/oauth-configured.guard';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string, isProd: boolean) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

@Controller('api/v1/auth')
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly voiceOtpService: VoiceOtpService,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
  ) {}

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithPhone(dto.phone, dto.otp, dto.password);
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    return result;
  }

  @Post('login/email')
  @Public()
  async loginEmail(@Body() dto: LoginEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithEmail(dto.email, dto.password);
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    return result;
  }

  @Get('me')
  @Auth()
  @SkipThrottle()
  async getMe(@CurrentUser('sub') userId: string) {
    const { user, businesses } = await this.authService.getMe(userId);
    return { success: true, data: { user, businesses } };
  }

  @Post('logout')
  @Public()
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @Post('sign-up/request')
  @Public()
  async signUpRequest(@Body() body: { email: string }) {
    if (!body.email?.trim()) {
      throw new BadRequestException('email is required');
    }
    return this.authService.signUpRequest(body.email.trim());
  }

  @Post('sign-up/verify')
  @Public()
  async signUpVerify(@Body() body: { email: string; code: string; password: string }, @Res({ passthrough: true }) res: Response) {
    if (!body.email?.trim() || !body.code?.trim() || !body.password?.trim()) {
      throw new BadRequestException('email, code, and password are required');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const result = await this.authService.signUpVerify(body.email.trim(), body.code.trim(), body.password);
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    return result;
  }

  @Post('sign-up')
  @Public()
  async signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signUp(dto.email, dto.password);
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    return result;
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email?.trim()) {
      throw new BadRequestException('email is required');
    }
    return this.authService.forgotPasswordRequest(body.email.trim());
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token?.trim() || !body.password?.trim()) {
      throw new BadRequestException('token and password are required');
    }
    return this.authService.resetPassword(body.token.trim(), body.password);
  }

  @Post('send-otp')
  @Public()
  async sendOtp(@Body() body: { phone: string }) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('invite/request-otp')
  @Public()
  async inviteRequestOtp(@Body() body: { token: string }) {
    if (!body.token?.trim()) {
      throw new BadRequestException('token is required');
    }
    return this.authService.inviteRequestOtp(body.token.trim());
  }

  @Post('invite/verify')
  @Public()
  async inviteVerify(@Body() body: { token: string; emailOrPhone: string; code: string; password: string }, @Res({ passthrough: true }) res: Response) {
    if (!body.token?.trim() || !body.emailOrPhone?.trim() || !body.code?.trim() || !body.password?.trim()) {
      throw new BadRequestException('token, emailOrPhone, code, and password are required');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const result = await this.authService.inviteVerify({
      token: body.token.trim(),
      emailOrPhone: body.emailOrPhone.trim(),
      code: body.code.trim(),
      password: body.password,
    });
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    return result;
  }

  @Post('send-voice-otp')
  @Public()
  async sendVoiceOtp(@Body() body: { phone: string; locale?: 'en' | 'fr' }) {
    return this.voiceOtpService.initiateCall(body.phone, body.locale || 'en');
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleOAuthConfiguredGuard, AuthGuard('google'))
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleOAuthConfiguredGuard, AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { id: string; email?: string; providerId: string; name?: string; picture?: string };
    const result = await this.authService.loginOrCreateOAuth(
      'google',
      user.providerId,
      user.email,
      user.name,
      user.picture,
    );
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') || process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const base = frontendUrl.replace(/\/$/, '');
    // Pass token in URL so frontend receives it reliably (cookie may not be sent cross-origin)
    const tokenParam = encodeURIComponent(result.accessToken);
    res.redirect(`${base}/auth/callback?token=${tokenParam}`);
  }

  @Get('facebook')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {
    // Guard redirects to Facebook
  }

  @Get('facebook/callback')
  @Public()
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
    const isProd = this.config?.get<string>('environment') === 'production';
    setAuthCookie(res, result.accessToken, isProd);
    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') || process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const base = frontendUrl.replace(/\/$/, '');
    const tokenParam = encodeURIComponent(result.accessToken);
    res.redirect(`${base}/auth/callback?token=${tokenParam}`);
  }
}
