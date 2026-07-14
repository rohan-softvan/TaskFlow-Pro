import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getExecutive(department?: string, dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dateFilter =
      dateFrom || dateTo
        ? {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          }
        : undefined;

    const projectWhere: any = {
      isArchived: false,
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const taskWhere: any = {};
    const taskCreatedWhere: any = {};

    if (department) {
      taskWhere.assignee = { department };
      taskCreatedWhere.creator = { department };
    }

    const [activeProjects, overdueTasks, completedThisWeek, projects, workload] =
      await Promise.all([
        this.prisma.project.count({
          where: { ...projectWhere, status: 'Active' },
        }),
        this.prisma.task.count({
          where: {
            ...taskWhere,
            status: { not: 'Done' },
            dueDate: { lt: now },
          },
        }),
        this.prisma.task.count({
          where: {
            ...taskCreatedWhere,
            status: 'Done',
            updatedAt: { gte: weekAgo },
          },
        }),
        this.prisma.project.findMany({
          where: projectWhere,
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
            _count: { select: { tasks: true } },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.task.groupBy({
          by: ['assigneeId'],
          where: {
            ...taskWhere,
            assigneeId: { not: null },
            status: { not: 'Done' },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        }),
      ]);

    const projectIds = projects.map((p) => p.id);
    const overdueCounts = projectIds.length > 0
      ? await this.prisma.task.groupBy({
          by: ['projectId'],
          where: {
            projectId: { in: projectIds },
            status: { not: 'Done' },
            dueDate: { lt: now },
          },
          _count: { id: true },
        })
      : [];
    const overdueMap = new Map(
      overdueCounts.map((d) => [d.projectId, d._count.id]),
    );

    const userMap = new Map<string, { id: string; fullName: string }>();
    if (workload.length > 0) {
      const assigneeIds = workload.map((w) => w.assigneeId!);
      const users = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, fullName: true },
      });
      for (const u of users) userMap.set(u.id, u);
    }

    const projectHealth = projects.map((p) => {
      const total = p._count.tasks;
      const overdue = overdueMap.get(p.id) ?? 0;
      const ratio = total > 0 ? overdue / total : 0;
      let rag: 'Green' | 'Amber' | 'Red';
      if (ratio === 0) rag = 'Green';
      else if (ratio <= 0.25) rag = 'Amber';
      else rag = 'Red';

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        owner: p.owner,
        totalTasks: total,
        overdueTasks: overdue,
        rag,
      };
    });

    const workloadBars = workload.map((w) => {
      const user = userMap.get(w.assigneeId!);
      return {
        assigneeId: w.assigneeId!,
        assigneeName: user?.fullName ?? 'Unknown',
        openTasks: w._count.id,
      };
    });

    const summaryCards = {
      activeProjects,
      overdueTasks,
      completedThisWeek,
    };

    return { summaryCards, projectHealth, workloadBars };
  }
}