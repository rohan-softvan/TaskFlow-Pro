import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { SKIP_MUST_RESET_PW_KEY } from '../decorators/skip-must-reset-password.decorator';

@Injectable()
export class MustResetPasswordGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_MUST_RESET_PW_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { id: string; role: UserRole; mustResetPw: boolean };
    }>();
    if (!req.user) return true;
    if (req.user.mustResetPw) {
      throw new ForbiddenException(
        'You must reset your password before accessing this resource',
      );
    }
    return true;
  }
}