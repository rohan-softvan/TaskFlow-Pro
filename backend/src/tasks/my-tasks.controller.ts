import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class MyTasksController {
  constructor(private tasks: TasksService) {}

  @Get('my')
  @ApiOperation({ summary: 'List tasks assigned to the current user across all projects' })
  findMyTasks(@Req() req: AuthRequest) {
    return this.tasks.findMyTasks(req.user.id);
  }
}
