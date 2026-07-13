import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private store = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 20;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.ip || 'unknown';
    const now = Date.now();

    let entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.store.set(key, entry);
    }

    entry.count++;
    if (entry.count > this.maxRequests) {
      throw new HttpException(
        { statusCode: 429, message: 'Too many requests', error: 'Rate Limit' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}