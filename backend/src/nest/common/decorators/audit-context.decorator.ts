import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type AuditRequest = Request & { auditIpAddress?: string; auditUserAgent?: string };

export const AuditIpAddress = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuditRequest>();
    return req.auditIpAddress;
  },
);

export const AuditUserAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuditRequest>();
    return req.auditUserAgent;
  },
);
