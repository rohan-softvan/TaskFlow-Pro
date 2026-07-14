import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchQueryDto } from './search.dto';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search across projects, tasks, comments (scoped to user)' })
  search(@Query() query: SearchQueryDto, @Req() req: AuthRequest) {
    return this.searchService.search(req.user.id, query);
  }
}
