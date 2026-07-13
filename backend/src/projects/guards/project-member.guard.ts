import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma';

export const OWNER_ONLY_KEY = 'ownerOnly';
export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user: { id: string; role: UserRole };
      params: { id?: string };
      isProjectOwner?: boolean;
    }>();
    const user = req.user;

    // Admins bypass all project membership checks
    if (user.role === UserRole.Admin) return true;

    const projectId = req.params.id;
    if (!projectId) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { userId: user.id }, take: 1 },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.ownerId === user.id;
    const isMember = isOwner || project.members.length > 0;

    if (!isMember) throw new ForbiddenException('Not a project member');

    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (ownerOnly && !isOwner) {
      throw new ForbiddenException('Only the project owner can perform this action');
    }

    req.isProjectOwner = isOwner;
    return true;
  }
}
