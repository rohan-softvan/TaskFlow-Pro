import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { AppController } from './app.controller';
import { LoggerService } from './common/logger.service';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, ProjectsModule],
  controllers: [AppController],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AppModule {}
