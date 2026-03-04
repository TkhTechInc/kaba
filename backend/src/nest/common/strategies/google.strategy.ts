import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const clientID = config?.get<string>('oauth.google.clientId') || process.env['GOOGLE_CLIENT_ID'] || 'dummy-google-client-id';
    const clientSecret = config?.get<string>('oauth.google.clientSecret') || process.env['GOOGLE_CLIENT_SECRET'] || 'dummy-google-secret';
    const callbackURL = config?.get<string>('oauth.google.callbackUrl') || process.env['GOOGLE_CALLBACK_URL'] || 'http://localhost:3001/api/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    done(null, {
      id: profile.id,
      providerId: profile.id,
      email,
      name: profile.displayName,
    });
  }
}
