import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Response } from 'express';
import { IdempotencyRepository } from './IdempotencyRepository';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const POLL_MS = 100;
const POLL_MAX_ATTEMPTS = 50; // ~5s max wait

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyRepo: IdempotencyRepository) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method?.toUpperCase();

    // Only apply to mutations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const key = request.headers[IDEMPOTENCY_HEADER]?.trim();
    if (!key || key.length < 16 || key.length > 128) {
      return next.handle();
    }

    // Check cache (completed request)
    const cached = await this.idempotencyRepo.get(key);
    if (cached) {
      response.status(cached.statusCode).json(cached.body);
      return of(undefined);
    }

    // Claim key — if another request is in flight, poll until it completes
    const claimed = await this.idempotencyRepo.claim(key);
    if (!claimed) {
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        await this.sleep(POLL_MS * (i + 1));
        const completed = await this.idempotencyRepo.get(key);
        if (completed) {
          response.status(completed.statusCode).json(completed.body);
          return of(undefined);
        }
      }
      // Timeout — fall through and run handler (worst case: duplicate)
      response.status(503).json({
        error: 'IdempotencyConflict',
        message: 'Another request with the same idempotency key is in progress',
      });
      return of(undefined);
    }

    return next.handle().pipe(
      tap(async (body) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            await this.idempotencyRepo.save(key, response.statusCode, body);
          } catch {
            // Non-fatal — idempotency save failed, but request succeeded
          }
        }
      }),
      catchError(async (err) => {
        try {
          await this.idempotencyRepo.release(key);
        } catch {
          // Ignore release failure
        }
        return throwError(() => err);
      }),
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
