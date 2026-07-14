import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatarPath: true,
} as const;

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId, parentTaskId: null },
      include: {
        assignee: { select: TASK_USER_SELECT },
        creator: { select: TASK_USER_SELECT },
        _count: { select: { subtasks: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: TASK_USER_SELECT },
        creator: { select: TASK_USER_SELECT },
        activityLogs: {
          include: { actor: { select: TASK_USER_SELECT } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(projectId: string, actorId: string, dto: CreateTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          title: dto.title,
          description: dto.description,
          assigneeId: dto.assigneeId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          priority: dto.priority,
          status: dto.status,
          createdBy: actorId,
        },
        include: {
          assignee: { select: TASK_USER_SELECT },
          creator: { select: TASK_USER_SELECT },
        },
      });

      await tx.activityLog.create({
        data: {
          taskId: task.id,
          projectId,
          actorId,
          action: ActivityAction.TaskCreated,
          detail: { title: task.title },
        },
      });

      return task;
    });
  }

  async update(
    taskId: string,
    actorId: string,
    actorRole: UserRole,
    dto: UpdateTaskDto,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // Members may only edit tasks they created or are assigned to
    if (actorRole === UserRole.Member) {
      if (task.createdBy !== actorId && task.assigneeId !== actorId) {
        throw new ForbiddenException(
          'Members can only edit tasks they created or are assigned to',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        include: {
          assignee: { select: TASK_USER_SELECT },
          creator: { select: TASK_USER_SELECT },
        },
      });

      // Log each changed field
      const logs: Promise<unknown>[] = [];

      if (dto.status !== undefined && dto.status !== task.status) {
        logs.push(
          tx.activityLog.create({
            data: {
              taskId,
              projectId: task.projectId,
              actorId,
              action: ActivityAction.StatusChanged,
              detail: { from: task.status, to: dto.status },
            },
          }),
        );
      }

      if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
        logs.push(
          tx.activityLog.create({
            data: {
              taskId,
              projectId: task.projectId,
              actorId,
              action: ActivityAction.AssigneeChanged,
              detail: { from: task.assigneeId, to: dto.assigneeId },
            },
          }),
        );
      }

      if (dto.dueDate !== undefined) {
        const newDate = dto.dueDate ?? null;
        const oldDate = task.dueDate?.toISOString().slice(0, 10) ?? null;
        if (newDate !== oldDate) {
          logs.push(
            tx.activityLog.create({
              data: {
                taskId,
                projectId: task.projectId,
                actorId,
                action: ActivityAction.DueDateChanged,
                detail: { from: oldDate, to: newDate },
              },
            }),
          );
        }
      }

      await Promise.all(logs);
      return updated;
    });
  }

  async remove(taskId: string, actorId: string, actorRole: UserRole) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    if (actorRole === UserRole.Member) {
      if (task.createdBy !== actorId && task.assigneeId !== actorId) {
        throw new ForbiddenException(
          'Members can only delete tasks they created or are assigned to',
        );
      }
    }

    return this.prisma.task.delete({ where: { id: taskId } });
  }
}
