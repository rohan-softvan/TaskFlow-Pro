import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipMustResetPassword } from '../auth/decorators/skip-must-reset-password.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MustResetPasswordGuard } from '../auth/guards/must-reset-password.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

const uploadStorage = diskStorage({
  destination: path.join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, MustResetPasswordGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@Req() req: AuthRequest) {
    return this.users.getMe(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, department, bio)' })
  updateMe(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(req.user.id, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload own avatar (≤2MB, JPEG/PNG/WebP)' })
  @ApiConsumes('multipart/form-data')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.uploadAvatar(req.user.id, file);
  }

  @Get('me/avatar')
  @ApiOperation({ summary: 'Stream own avatar image (auth required)' })
  async getMyAvatar(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filename = await this.users.getAvatarFilename(req.user.id);
    if (!filename) throw new NotFoundException('No avatar set');

    const filePath = path.join(process.cwd(), 'uploads', path.basename(filename));
    if (!fs.existsSync(filePath)) throw new NotFoundException('Avatar not found');

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    res.set({
      'Content-Type': mimeMap[ext] || 'application/octet-stream',
      'Cache-Control': 'private, no-cache',
    });
    return new StreamableFile(fs.createReadStream(filePath));
  }

  @Get()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'List all users (Admin only)' })
  findAll() {
    return this.users.findAll();
  }

  @Post()
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Create a new user with temp password (Admin only)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch('me/change-password')
  @SkipMustResetPassword()
  @ApiOperation({ summary: 'Change own password — clears must_reset_pw' })
  changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(req.user.id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Update user role / status (Admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthRequest,
  ) {
    return this.users.update(id, dto, req.user.id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Deactivate a user (Admin only)' })
  deactivate(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.users.deactivate(id, req.user.id);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Reset user password — returns temp password (Admin only)' })
  resetPassword(@Param('id') id: string) {
    return this.users.resetPassword(id);
  }
}
