import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma';

@Injectable()
export class TaskProjectMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user: { id: string; role: UserRole };
      params: { projectId?: string };
    }>();
    const user = req.user;

    if (user.role === UserRole.Admin) return true;

    const projectId = req.params.projectId;
    if (!projectId) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId: user.id }, take: 1 } },
    });

    if (!project) throw new NotFoundException('Project not found');

    const isMember = project.ownerId === user.id || project.members.length > 0;
    if (!isMember) throw new ForbiddenException('Not a project member');

    return true;
  }
}
