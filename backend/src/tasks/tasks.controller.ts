import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskProjectMemberGuard } from './guards/task-project-member.guard';
import { TasksService } from './tasks.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  @UseGuards(TaskProjectMemberGuard)
  @ApiOperation({ summary: 'List tasks in a project' })
  findAll(@Param('projectId') projectId: string) {
    return this.tasks.findAll(projectId);
  }

  @Post()
  @UseGuards(TaskProjectMemberGuard)
  @ApiOperation({ summary: 'Create a task in a project' })
  create(
    @Req() req: AuthRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(projectId, req.user.id, dto);
  }

  @Get(':taskId')
  @UseGuards(TaskProjectMemberGuard)
  @ApiOperation({ summary: 'Get task detail + activity log' })
  findOne(@Param('taskId') taskId: string) {
    return this.tasks.findOne(taskId);
  }

  @Patch(':taskId')
  @UseGuards(TaskProjectMemberGuard)
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(taskId, req.user.id, req.user.role, dto);
  }

  @Delete(':taskId')
  @UseGuards(TaskProjectMemberGuard)
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Req() req: AuthRequest, @Param('taskId') taskId: string) {
    return this.tasks.remove(taskId, req.user.id, req.user.role);
  }
}
