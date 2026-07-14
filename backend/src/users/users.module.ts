import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MustResetPasswordGuard } from '../auth/guards/must-reset-password.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, MustResetPasswordGuard],
  exports: [UsersService],
})
export class UsersModule {}
