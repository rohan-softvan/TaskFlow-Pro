import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { AttachmentsService } from './attachments.service';
import { createReadStream } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '10', 10);

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/markdown',
];

function multerDiskStorage() {
  return diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = crypto.randomUUID() + ext;
      cb(null, name);
    },
  });
}

function mimeTypeFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, accept: boolean) => void,
) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
}

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private attachments: AttachmentsService) {}

  @Get('tasks/:taskId/attachments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager, UserRole.Member)
  @ApiOperation({ summary: 'List attachments for a task (members only)' })
  findAll(@Param('taskId') taskId: string) {
    return this.attachments.findAll(taskId);
  }

  @Post('tasks/:taskId/attachments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager, UserRole.Member)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerDiskStorage(),
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
      fileFilter: mimeTypeFilter,
    }),
  )
  @ApiOperation({ summary: 'Upload an attachment (≤10MB, members only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  upload(
    @Req() req: AuthRequest,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachments.upload(taskId, req.user.id, file);
  }

  @Get('attachments/:id/download')
  @ApiOperation({ summary: 'Download an attachment (members only)' })
  async download(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const attachment = await this.attachments.getDownloadInfo(
      id,
      req.user.id,
    );

    const stream = createReadStream(attachment.storagePath);
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
      'Content-Length': attachment.sizeBytes.toString(),
    });
    return new StreamableFile(stream);
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an attachment (own uploader / PM / Admin)' })
  remove(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.attachments.remove(id, req.user.id, req.user.role);
  }
}