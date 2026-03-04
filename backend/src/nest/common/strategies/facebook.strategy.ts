import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const clientID = config?.get<string>('oauth.facebook.clientId') || process.env['FACEBOOK_APP_ID'];
    const clientSecret = config?.get<string>('oauth.facebook.clientSecret') || process.env['FACEBOOK_APP_SECRET'];
    const callbackURL = config?.get<string>('oauth.facebook.callbackUrl') || process.env['FACEBOOK_CALLBACK_URL'];

    super({
      clientID: clientID || 'dummy-facebook-app-id',
      clientSecret: clientSecret || 'dummy-facebook-secret',
      callbackURL: callbackURL || 'http://localhost:3001/api/v1/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: { id: string; emails?: { value: string }[]; displayName?: string },
  ): Promise<{ id: string; providerId: string; email?: string; name?: string }> {
    const email = profile.emails?.[0]?.value;
    return {
      id: profile.id,
      providerId: profile.id,
      email,
      name: profile.displayName,
    };
  }
}
