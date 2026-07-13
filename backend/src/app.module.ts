import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [AppController],
})
export class AppModule {}
