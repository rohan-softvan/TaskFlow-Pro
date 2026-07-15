import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma';
import {
  COMMENT_MENTION_EVENT,
  TASK_ASSIGNED_EVENT as TASK_ASSIGNED_EV,
  TASK_STATUS_CHANGED_EVENT as TASK_STATUS_EV,
  taskEvents,
} from '../tasks/tasks.service';

interface MentionPayload {
  commentId: string;
  taskId: string;
  projectId: string;
  actorId: string;
  mentionedUserId: string;
}

interface AssignPayload {
  taskId: string;
  projectId: string;
  actorId: string;
  assigneeId: string;
}

interface StatusPayload {
  taskId: string;
  projectId: string;
  actorId: string;
  newStatus: string;
  createdBy: string;
  assigneeId: string | null;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    taskEvents.on(COMMENT_MENTION_EVENT, (p: MentionPayload) =>
      this.onCommentMention(p),
    );
    taskEvents.on(TASK_ASSIGNED_EV, (p: AssignPayload) =>
      this.onTaskAssigned(p),
    );
    taskEvents.on(TASK_STATUS_EV, (p: StatusPayload) =>
      this.onTaskStatusChanged(p),
    );
  }

  private async onCommentMention(p: MentionPayload) {
    if (p.mentionedUserId === p.actorId) return;
    await this.prisma.notification.create({
      data: {
        recipientId: p.mentionedUserId,
        type: NotificationType.CommentMention,
        taskId: p.taskId,
        projectId: p.projectId,
        actorId: p.actorId,
        message: 'You were mentioned in a comment',
      },
    });
  }

  private async onTaskAssigned(p: AssignPayload) {
    if (p.assigneeId === p.actorId) return;
    await this.prisma.notification.create({
      data: {
        recipientId: p.assigneeId,
        type: NotificationType.TaskAssigned,
        taskId: p.taskId,
        projectId: p.projectId,
        actorId: p.actorId,
        message: 'A task has been assigned to you',
      },
    });
  }

  private async onTaskStatusChanged(p: StatusPayload) {
    const recipients = new Set<string>();
    if (p.createdBy && p.createdBy !== p.actorId) recipients.add(p.createdBy);
    if (p.assigneeId && p.assigneeId !== p.actorId)
      recipients.add(p.assigneeId);

    await Promise.all(
      [...recipients].map((recipientId) =>
        this.prisma.notification.create({
          data: {
            recipientId,
            type: NotificationType.TaskStatusChanged,
            taskId: p.taskId,
            projectId: p.projectId,
            actorId: p.actorId,
            message: `Task status changed to ${p.newStatus}`,
          },
        }),
      ),
    );
  }

  // Run every hour — notify assignees of tasks due within 24h (once per day de-dup)
  @Cron(CronExpression.EVERY_HOUR)
  async dueSoonCron() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: { not: null },
        dueDate: { gte: now, lte: in24h },
        status: { not: 'Done' },
      },
      select: {
        id: true,
        projectId: true,
        assigneeId: true,
        title: true,
      },
    });

    for (const task of tasks) {
      if (!task.assigneeId) continue;
      const dayKey = now.toISOString().slice(0, 10);
      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: task.assigneeId,
          taskId: task.id,
          type: NotificationType.TaskDueSoon,
          createdAt: {
            gte: new Date(`${dayKey}T00:00:00.000Z`),
            lte: new Date(`${dayKey}T23:59:59.999Z`),
          },
        },
      });
      if (!existing) {
        await this.prisma.notification.create({
          data: {
            recipientId: task.assigneeId,
            type: NotificationType.TaskDueSoon,
            taskId: task.id,
            projectId: task.projectId,
            message: `Task "${task.title}" is due within 24 hours`,
          },
        });
      }
    }
  }

  async emit(type: NotificationType, data: {
    recipientId: string;
    taskId?: string;
    projectId?: string;
    actorId?: string;
    message: string;
  }) {
    return this.prisma.notification.create({ data: { type, ...data } });
  }

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }
}
