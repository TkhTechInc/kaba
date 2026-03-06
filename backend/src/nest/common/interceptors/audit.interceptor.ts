import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { auditIpAddress?: string; auditUserAgent?: string }>();

    if (MUTATING_METHODS.has(req.method)) {
      const forwarded = req.headers['x-forwarded-for'];
      const ip =
        (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
        req.ip ??
        '';

      req.auditIpAddress = ip;
      req.auditUserAgent = req.headers['user-agent'] ?? '';
    }

    return next.handle();
  }
}
