import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, UserRole } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(taskId: string) {
    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        uploader: {
          select: { id: true, fullName: true, email: true, avatarPath: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    taskId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.taskAttachment.create({
        data: {
          taskId,
          fileName: file.originalname,
          storagePath: file.path,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: userId,
        },
        include: {
          uploader: {
            select: { id: true, fullName: true, email: true, avatarPath: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          taskId,
          projectId: task.projectId,
          actorId: userId,
          action: ActivityAction.AttachmentAdded,
          detail: { fileName: file.originalname },
        },
      });

      return attachment;
    });
  }

  async getDownloadInfo(attachmentId: string, userId: string) {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: { select: { projectId: true } },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const project = await this.prisma.project.findUnique({
      where: { id: attachment.task.projectId },
      include: {
        members: { where: { userId }, take: 1 },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const isMember =
      project.ownerId === userId || project.members.length > 0;
    if (!isMember) throw new ForbiddenException('Not a project member');

    const filePath = path.resolve(attachment.storagePath);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) throw new NotFoundException('File not found on disk');

    return attachment;
  }

  async remove(attachmentId: string, userId: string, userRole: UserRole) {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, taskId: true, storagePath: true, uploadedBy: true },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const task = await this.prisma.task.findUnique({
      where: { id: attachment.taskId },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.prisma.project.findUnique({
      where: { id: task.projectId },
      select: { ownerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = attachment.uploadedBy === userId;
    const isProjectOwner = project.ownerId === userId;
    const isAdmin = userRole === UserRole.Admin;
    const isPM = userRole === UserRole.ProjectManager;

    if (!isOwner && !isProjectOwner && !isAdmin && !isPM) {
      throw new ForbiddenException(
        'Only the uploader, PM, or Admin can delete this attachment',
      );
    }

    await this.prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    await fs.unlink(attachment.storagePath).catch(() => {
      // file may already be gone — ignore
    });
  }
}