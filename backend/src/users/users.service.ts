import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function safeUser(user: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => safeUser(u as unknown as Record<string, unknown>));
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return safeUser(user as unknown as Record<string, unknown>);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
      },
    });
    return safeUser(updated as unknown as Record<string, unknown>);
  }

  async getAvatarFilename(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    return user?.avatarPath ?? null;
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      fs.unlinkSync(file.path);
      throw new BadRequestException('Only JPEG, PNG and WebP images are allowed');
    }

    // Remove old avatar file if present
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (existing?.avatarPath) {
      const oldPath = path.join(process.cwd(), 'uploads', existing.avatarPath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const filename = path.basename(file.path);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: filename },
    });
    return safeUser(updated as unknown as Record<string, unknown>);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        role: dto.role ?? UserRole.Member,
        department: dto.department,
        mustResetPw: true,
      },
    });

    return {
      ...safeUser(user as unknown as Record<string, unknown>),
      tempPassword,
    };
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (id === actorId && dto.role !== undefined && dto.role !== user.role) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      },
    });
    return safeUser(updated as unknown as Record<string, unknown>);
  }

  async deactivate(id: string, actorId: string) {
    if (id === actorId) throw new ForbiddenException('Cannot deactivate yourself');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return safeUser(updated as unknown as Record<string, unknown>);
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustResetPw: true },
    });

    return { tempPassword };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPw: false },
    });
    return { message: 'Password updated' };
  }
}
