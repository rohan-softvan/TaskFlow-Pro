import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, UserRole } from '@prisma/client';
import { EventEmitter } from 'events';
import { PrismaService } from '../prisma';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

// Simple in-process event bus for CommentMention events (consumed by Slice 9)
export const taskEvents = new EventEmitter();
export const COMMENT_MENTION_EVENT = 'CommentMention';

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

  // --- Subtasks ---

  async listSubtasks(parentTaskId: string) {
    return this.prisma.task.findMany({
      where: { parentTaskId },
      include: {
        assignee: { select: TASK_USER_SELECT },
        creator: { select: TASK_USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSubtask(
    parentTaskId: string,
    actorId: string,
    dto: CreateSubtaskDto,
  ) {
    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
    });
    if (!parent) throw new NotFoundException('Parent task not found');
    if (parent.parentTaskId) {
      throw new BadRequestException(
        'Cannot create a subtask of a subtask (max one level of nesting)',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const subtask = await tx.task.create({
        data: {
          projectId: parent.projectId,
          parentTaskId,
          title: dto.title,
          description: dto.description,
          assigneeId: dto.assigneeId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          priority: dto.priority ?? parent.priority,
          createdBy: actorId,
        },
        include: {
          assignee: { select: TASK_USER_SELECT },
          creator: { select: TASK_USER_SELECT },
        },
      });

      await tx.activityLog.create({
        data: {
          taskId: parentTaskId,
          projectId: parent.projectId,
          actorId,
          action: ActivityAction.TaskCreated,
          detail: { subtaskId: subtask.id, title: subtask.title },
        },
      });

      return subtask;
    });
  }

  // --- Comments ---

  async listComments(taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: { select: TASK_USER_SELECT },
        mentions: {
          include: { user: { select: TASK_USER_SELECT } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createComment(taskId: string, actorId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // Parse @mentions: match @username patterns (word chars, dots, hyphens)
    const mentionHandles = [
      ...new Set(
        [...dto.body.matchAll(/@([\w.\-]+)/g)].map((m) => m[1].toLowerCase()),
      ),
    ];

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId,
          authorId: actorId,
          body: dto.body,
        },
        include: {
          author: { select: TASK_USER_SELECT },
        },
      });

      // Resolve mentioned users by email prefix or fullName (match on email localpart)
      if (mentionHandles.length > 0) {
        const mentionedUsers = await tx.user.findMany({
          where: {
            OR: mentionHandles.map((h) => ({
              email: { startsWith: h, mode: 'insensitive' as const },
            })),
          },
          select: { id: true, email: true, fullName: true },
        });

        if (mentionedUsers.length > 0) {
          await tx.commentMention.createMany({
            data: mentionedUsers.map((u) => ({
              commentId: comment.id,
              mentionedUser: u.id,
            })),
            skipDuplicates: true,
          });

          // Emit event for each mention (Slice 9 will subscribe)
          for (const u of mentionedUsers) {
            taskEvents.emit(COMMENT_MENTION_EVENT, {
              commentId: comment.id,
              taskId,
              projectId: task.projectId,
              actorId,
              mentionedUserId: u.id,
            });
          }
        }
      }

      await tx.activityLog.create({
        data: {
          taskId,
          projectId: task.projectId,
          actorId,
          action: ActivityAction.CommentAdded,
          detail: { commentId: comment.id },
        },
      });

      return comment;
    });
  }

  async deleteComment(
    commentId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    if (
      actorRole === UserRole.Member &&
      comment.authorId !== actorId
    ) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }
}
