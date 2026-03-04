import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC } from '../decorators/auth.decorator';
import type { ApiKeyPayload } from '../types/auth.types';
import { ApiKeyService } from '@/domains/api-keys/ApiKeyService';

/**
 * Combined auth guard: accepts either JWT (Authorization: Bearer) or API key (X-API-Key).
 * Tries API key first if header present, otherwise falls through to JWT.
 * ApiKeyService is resolved lazily via ModuleRef to avoid circular initialization in Lambda.
 */
@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('jwt') {
  private _apiKeyService?: ApiKeyService;

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  private get apiKeyService(): ApiKeyService {
    if (!this._apiKeyService) {
      this._apiKeyService = this.moduleRef.get(ApiKeyService, { strict: false });
    }
    return this._apiKeyService;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (apiKey) {
      const result = await this.apiKeyService.validate(apiKey);
      if (result) {
        const payload: ApiKeyPayload = {
          sub: 'apikey',
          businessId: result.businessId,
          scopes: result.scopes,
          keyId: result.keyId,
        };
        (request as any).user = payload;
        return true;
      }
      throw new UnauthorizedException('Invalid API key');
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser = any>(err: any, user: any, _info?: any, _context?: ExecutionContext, _status?: any): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token. Please login again.');
    }
    return user as TUser;
  }

  private extractApiKey(request: Request): string | undefined {
    const header = request.headers['x-api-key'];
    if (typeof header === 'string') return header;
    return undefined;
  }
}
