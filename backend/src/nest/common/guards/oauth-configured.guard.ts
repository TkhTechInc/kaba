import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const DUMMY_CLIENT_ID = 'dummy-google-client-id';

@Injectable()
export class GoogleOAuthConfiguredGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    if (!clientId || clientId === DUMMY_CLIENT_ID) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured. Create secret kaba/{env}/google-oauth with client_id and client_secret, or deploy with -c googleClientId=... -c googleClientSecret=...',
      );
    }
    return true;
  }
}
