import { Controller, Get, Patch, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('unread')
  async getUnread(@Request() req) {
    // JWT strategy returns role as a plain string (not an object)
    const userRole = req.user.role;
    return this.notificationsService.getUnread(req.user.tenantId, userRole, req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.tenantId, id);
  }

  @Patch('read-all')
  async markAllRead(@Request() req) {
    const userRole = req.user.role;
    return this.notificationsService.markAllAsRead(req.user.tenantId, userRole, req.user.id);
  }

  @Roles('ADMIN')
  @Post()
  async createNotification(
    @Request() req,
    @Body() body: { tenantId?: string; roleName: string; title: string; message: string; link?: string },
  ) {
    return this.notificationsService.createNotification({
      tenantId: body.tenantId || req.user.tenantId,
      roleName: body.roleName,
      title: body.title,
      message: body.message,
      link: body.link,
    });
  }
}

