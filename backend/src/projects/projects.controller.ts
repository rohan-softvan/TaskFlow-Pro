import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { ArchiveDto } from './dto/archive.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMemberGuard } from './guards/project-member.guard';
import { ProjectsService } from './projects.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects the current user belongs to' })
  findAll(@Req() req: AuthRequest, @Query('archived') archived?: string) {
    return this.projects.findAll(
      req.user.id,
      req.user.role,
      archived === 'true',
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Create a project (PM/Admin only)' })
  create(@Req() req: AuthRequest, @Body() dto: CreateProjectDto) {
    return this.projects.create(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'Get a single project (members only)' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Update project details (PM/Admin member only)' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Delete a project (PM/Admin member only)' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Change project status (PM/Admin member only)' })
  changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.projects.changeStatus(id, dto);
  }

  @Patch(':id/archive')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Archive / unarchive a project (PM/Admin member only)' })
  setArchived(@Param('id') id: string, @Body() dto: ArchiveDto) {
    return this.projects.setArchived(id, dto.archive);
  }

  @Get(':id/members')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'List project members (members only)' })
  getMembers(@Param('id') id: string) {
    return this.projects.getMembers(id);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Add a member (PM/Admin member only)' })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.projects.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(RolesGuard, ProjectMemberGuard)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: 'Remove a member (PM/Admin member only)' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projects.removeMember(id, userId);
  }
}
