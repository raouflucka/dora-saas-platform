import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getUnread(tenantId: string, roleName: string, userId?: string) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { roleName },   // broadcast to role
          { userId },     // targeted to specific user
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  async markAsRead(tenantId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, tenantId },
      data: { isRead: true }
    });
  }

  async markAllAsRead(tenantId: string, roleName: string, userId?: string) {
    return this.prisma.notification.updateMany({
      where: {
        tenantId,
        isRead: false,
        OR: [
          { roleName },
          { userId },
        ]
      },
      data: { isRead: true }
    });
  }

  async createNotification(data: {
    tenantId: string;
    roleName?: string;
    userId?: string;
    title: string;
    message: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId: data.tenantId,
        roleName: data.roleName,
        userId: data.userId,
        title: data.title,
        message: data.message,
        link: data.link
      }
    });
  }
}
