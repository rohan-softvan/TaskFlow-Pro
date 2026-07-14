import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { TaskProjectMemberGuard } from './guards/task-project-member.guard';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, TaskProjectMemberGuard],
})
export class TasksModule {}
