import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types/auth.types';
import type { ApiKeyPayload } from '../types/auth.types';

/**
 * Extracts the audit userId from the request.
 * - When sub === 'apikey': returns keyId (API key identifier)
 * - Otherwise: returns sub (JWT user id)
 */
export const AuditUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return undefined;
    if (user.sub === 'apikey') {
      return (user as ApiKeyPayload).keyId;
    }
    return user.sub;
  },
);
