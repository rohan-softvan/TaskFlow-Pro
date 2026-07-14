import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { LoggerService } from './common/logger.service';

@Module({
  imports: [PrismaModule, AttachmentsModule, AuthModule, DashboardModule, UsersModule, ProjectsModule, TasksModule],
  controllers: [AppController],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class AppModule {}
