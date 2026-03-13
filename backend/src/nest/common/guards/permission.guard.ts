import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { Permission } from '@/domains/access/role.types';
import { AccessService } from '@/domains/access/AccessService';
import type { AuthUser } from '../types/auth.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  private _accessService?: AccessService;

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get accessService(): AccessService {
    if (!this._accessService) {
      this._accessService = this.moduleRef.get(AccessService, { strict: false });
    }
    return this._accessService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const businessId = this.extractBusinessId(request);
    if (!businessId?.trim()) {
      throw new ForbiddenException('businessId is required for this operation');
    }

    // API key: allow if businessId matches and scope includes permission
    if (user.sub === 'apikey' && 'scopes' in user) {
      if (user.businessId !== businessId) {
        throw new ForbiddenException('API key does not have access to this business');
      }
      if (!user.scopes.includes(permission)) {
        throw new ForbiddenException(`API key does not have permission: ${permission}`);
      }
      return true;
    }

    const allowed = await this.accessService.canAccess(businessId, user.sub, permission);
    if (!allowed) {
      throw new ForbiddenException(`You do not have permission: ${permission}`);
    }
    return true;
  }

  private extractBusinessId(request: Request): string | undefined {
    const params = (request.params as Record<string, unknown>) || {};
    const body = (request.body as Record<string, unknown>) || {};
    const query = (request.query as Record<string, unknown>) || {};
    return (
      (params.businessId as string) ??
      (body.businessId as string) ??
      (body.parentBusinessId as string) ??
      (query.businessId as string)
    );
  }
}
