/**
 * Unit tests for AuthController.
 * Includes regression test for OAuth callback redirect URL formation
 * (dev.kabasika.comauth/callback bug - missing slash before path).
 */
import { AuthController } from '../auth.controller';
import type { AuthService } from '../auth.service';
import type { VoiceOtpService } from '@/domains/voice/VoiceOtpService';
import type { ConfigService } from '@nestjs/config';

function makeAuthService(): jest.Mocked<Pick<AuthService, 'loginOrCreateOAuth'>> {
  return {
    loginOrCreateOAuth: jest.fn().mockResolvedValue({
      accessToken: 'test-jwt-token',
      user: { id: 'u1', email: 'test@example.com' },
    }),
  } as unknown as jest.Mocked<Pick<AuthService, 'loginOrCreateOAuth'>>;
}

function makeConfigService(frontendUrl: string): jest.Mocked<Pick<ConfigService, 'get'>> {
  return {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'oauth.frontendUrl') return frontendUrl;
      if (key === 'environment') return 'development';
      return undefined;
    }),
  } as unknown as jest.Mocked<Pick<ConfigService, 'get'>>;
}

function makeRequest(user: object): { user: object; headers: Record<string, string> } {
  return { user, headers: { 'accept-language': 'en' } };
}

function makeResponse(): { redirect: jest.Mock; cookie: jest.Mock } {
  return {
    redirect: jest.fn(),
    cookie: jest.fn(),
  };
}

function makeController(frontendUrl: string) {
  const authService = makeAuthService();
  const configService = makeConfigService(frontendUrl);
  const voiceOtpService = {} as VoiceOtpService;
  const controller = new AuthController(
    authService as unknown as AuthService,
    voiceOtpService,
    configService as unknown as ConfigService,
  );
  return { controller, authService, configService };
}

describe('AuthController OAuth callback redirect URL', () => {
  it('redirects to https://dev.kabasika.com/auth/callback?token=... (regression: no dev.kabasika.comauth)', async () => {
    const { controller } = makeController('https://dev.kabasika.com');
    const req = makeRequest({ providerId: 'g123', email: 'u@test.com' });
    const res = makeResponse();

    await controller.googleCallback(req as any, res as any);

    const redirectUrl = res.redirect.mock.calls[0][0];
    expect(redirectUrl).toBe('https://dev.kabasika.com/auth/callback?token=test-jwt-token');
    // Regression: buggy separator logic produced dev.kabasika.comauth/callback (DNS_PROBE_FINISHED_NXDOMAIN)
    expect(redirectUrl).not.toMatch(/\.comauth/);
    expect(redirectUrl).toMatch(/\/auth\/callback\?token=/);
  });

  it('redirects to correct URL when frontendUrl has trailing slash', async () => {
    const { controller } = makeController('https://dev.kabasika.com/');
    const req = makeRequest({ providerId: 'g123', email: 'u@test.com' });
    const res = makeResponse();

    await controller.googleCallback(req as any, res as any);

    expect(res.redirect).toHaveBeenCalledWith('https://dev.kabasika.com/auth/callback?token=test-jwt-token');
  });

  it('redirects to correct URL for app.kabasika.com (prod)', async () => {
    const { controller } = makeController('https://app.kabasika.com');
    const req = makeRequest({ providerId: 'g123', email: 'u@test.com' });
    const res = makeResponse();

    await controller.googleCallback(req as any, res as any);

    expect(res.redirect).toHaveBeenCalledWith('https://app.kabasika.com/auth/callback?token=test-jwt-token');
  });

  it('redirects to correct URL for localhost', async () => {
    const { controller } = makeController('http://localhost:3000');
    const req = makeRequest({ providerId: 'g123', email: 'u@test.com' });
    const res = makeResponse();

    await controller.googleCallback(req as any, res as any);

    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback?token=test-jwt-token');
  });

  it('facebookCallback redirects to correct URL (same logic as googleCallback)', async () => {
    const { controller } = makeController('https://app.kabasika.com');
    const req = makeRequest({ providerId: 'fb123', email: 'u@test.com' });
    const res = makeResponse();

    await controller.facebookCallback(req as any, res as any);

    expect(res.redirect).toHaveBeenCalledWith('https://app.kabasika.com/auth/callback?token=test-jwt-token');
  });
});
