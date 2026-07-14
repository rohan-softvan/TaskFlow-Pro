import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './search.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(userId: string, query: SearchQueryDto) {
    const { q, assignee, status, priority, dueFrom, dueTo } = query;

    if (!q || q.trim() === '') {
      return { projects: [], tasks: [], comments: [] };
    }

    const term = q.trim();

    // Get user's member project IDs (scoped search)
    const memberProjects = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const ownedProjects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const projectIds = [
      ...new Set([
        ...memberProjects.map((p) => p.projectId),
        ...ownedProjects.map((p) => p.id),
      ]),
    ];

    if (projectIds.length === 0) {
      return { projects: [], tasks: [], comments: [] };
    }

    // Search projects
    const projects = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; description: string | null; status: string }>
    >(
      Prisma.sql`
        SELECT id, name, description, status
        FROM projects
        WHERE id = ANY(${projectIds}::uuid[])
          AND is_archived = false
          AND to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${term})
        LIMIT 20
      `,
    );

    // Build task filters
    const taskWhere: Prisma.TaskWhereInput = {
      projectId: { in: projectIds },
    };
    if (assignee) taskWhere.assigneeId = assignee;
    if (status) taskWhere.status = status;
    if (priority) taskWhere.priority = priority;
    if (dueFrom || dueTo) {
      taskWhere.dueDate = {};
      if (dueFrom) (taskWhere.dueDate as Prisma.DateTimeFilter).gte = new Date(dueFrom);
      if (dueTo) (taskWhere.dueDate as Prisma.DateTimeFilter).lte = new Date(dueTo);
    }

    // Task ID filter from project scope + filters
    const scopedTasks = await this.prisma.task.findMany({
      where: taskWhere,
      select: { id: true },
    });
    const scopedTaskIds = scopedTasks.map((t) => t.id);

    if (scopedTaskIds.length === 0) {
      return { projects, tasks: [], comments: [] };
    }

    // FTS on tasks
    const tasks = await this.prisma.$queryRaw<
      Array<{
        id: string;
        project_id: string;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        due_date: Date | null;
        assignee_id: string | null;
      }>
    >(
      Prisma.sql`
        SELECT id, project_id, title, description, status, priority, due_date, assignee_id
        FROM tasks
        WHERE id = ANY(${scopedTaskIds}::uuid[])
          AND to_tsvector('english', title || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', ${term})
        LIMIT 30
      `,
    );

    // FTS on comments scoped to task IDs
    const comments = await this.prisma.$queryRaw<
      Array<{ id: string; task_id: string; body: string; author_id: string; created_at: Date }>
    >(
      Prisma.sql`
        SELECT tc.id, tc.task_id, tc.body, tc.author_id, tc.created_at
        FROM task_comments tc
        WHERE tc.task_id = ANY(${scopedTaskIds}::uuid[])
          AND to_tsvector('english', tc.body) @@ plainto_tsquery('english', ${term})
        LIMIT 20
      `,
    );

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        type: 'project' as const,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        assigneeId: t.assignee_id,
        type: 'task' as const,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        taskId: c.task_id,
        body: c.body,
        authorId: c.author_id,
        createdAt: c.created_at,
        type: 'comment' as const,
      })),
    };
  }
}
