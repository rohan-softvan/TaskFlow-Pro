import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

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
