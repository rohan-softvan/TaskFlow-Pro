import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
