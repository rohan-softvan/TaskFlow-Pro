import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { sub: string } }) {
    return this.notificationsService.findForUser(req.user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.notificationsService.markRead(id, req.user.sub);
  }

  @Post('read-all')
  markAllRead(@Req() req: { user: { sub: string } }) {
    return this.notificationsService.markAllRead(req.user.sub);
  }
}
