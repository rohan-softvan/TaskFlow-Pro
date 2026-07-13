import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma';
import { AddMemberDto } from './dto/add-member.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const OWNER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatarPath: true,
} as const;

const MEMBER_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  department: true,
  avatarPath: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, role: UserRole, showArchived = false) {
    const where = {
      ...(!showArchived && { isArchived: false }),
      ...(role !== UserRole.Admin && {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ] as const,
      }),
    };

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        owner: { select: OWNER_SELECT },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const doneCounts = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, status: TaskStatus.Done },
      _count: { id: true },
    });
    const doneMap = new Map(doneCounts.map((d) => [d.projectId, d._count.id]));

    return projects.map((p) => ({
      ...p,
      progress:
        p._count.tasks > 0
          ? Math.round(((doneMap.get(p.id) ?? 0) / p._count.tasks) * 100)
          : 0,
    }));
  }

  async create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          ownerId,
        },
      });

      await tx.projectMember.create({
        data: { projectId: project.id, userId: ownerId },
      });

      return project;
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: OWNER_SELECT },
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
        },
        _count: { select: { tasks: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const doneCount = await this.prisma.task.count({
      where: { projectId: id, status: TaskStatus.Done },
    });

    return {
      ...project,
      progress:
        project._count.tasks > 0
          ? Math.round((doneCount / project._count.tasks) * 100)
          : 0,
    };
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.isArchived)
      throw new ForbiddenException('Cannot modify an archived project');

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.delete({ where: { id } });
  }

  async changeStatus(id: string, dto: ChangeStatusDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.isArchived)
      throw new ForbiddenException('Cannot modify an archived project');
    return this.prisma.project.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async setArchived(id: string, archive: boolean) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    return this.prisma.project.update({
      where: { id },
      data: { isArchived: archive },
    });
  }

  async getMembers(id: string) {
    const exists = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Project not found');
    return this.prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: MEMBER_USER_SELECT } },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const [project, user] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
    ]);
    if (!project) throw new NotFoundException('Project not found');
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('User is not active');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId },
      include: { user: { select: MEMBER_USER_SELECT } },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId)
      throw new ForbiddenException('Cannot remove the project owner');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!existing) throw new NotFoundException('User is not a member');

    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
