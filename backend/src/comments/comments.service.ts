import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(tenantId: string, authorId: string, data: CreateCommentDto) {
    const comment = await this.prisma.comment.create({
      data: {
        tenantId,
        authorId,
        entityType: data.entityType,
        entityId: data.entityId,
        content: data.content,
      },
      include: {
        author: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    if (comment.author.role.roleName === 'EDITOR') {
      let link = '';
      let title = 'New Editor Note';
      if (data.entityType === 'ContractualArrangement') {
        link = `/contracts?openContractId=${data.entityId}`;
        title = 'New Note on Contract';
      } else if (data.entityType === 'IctProvider') {
        link = `/providers?openProviderId=${data.entityId}`;
        title = 'New Note on Provider';
      } else if (data.entityType === 'ExitStrategy') {
        link = `/exit-strategies?openExitStrategyId=${data.entityId}`;
        title = 'New Note on Exit Strategy';
      }

      if (link) {
        await this.notificationsService.createNotification({
          tenantId,
          roleName: 'ANALYST',
          title,
          message: `Editor ${comment.author.email || comment.author.fullName} left a note for review.`,
          link
        });
      }
    } else if (comment.author.role.roleName === 'ANALYST') {
      let link = '';
      let title = 'New Analyst Note';
      if (data.entityType === 'ContractualArrangement') {
        link = `/contracts?openContractId=${data.entityId}`;
        title = 'Analyst Note on Contract';
      } else if (data.entityType === 'IctProvider') {
        link = `/providers?openProviderId=${data.entityId}`;
        title = 'Analyst Note on Provider';
      } else if (data.entityType === 'ExitStrategy') {
        link = `/exit-strategies?openExitStrategyId=${data.entityId}`;
        title = 'Analyst Note on Exit Strategy';
      }
      
      if (link) {
        await this.notificationsService.createNotification({
          tenantId,
          roleName: 'EDITOR',
          title,
          message: `Analyst ${comment.author.email || comment.author.fullName} replied to a record.`,
          link
        });
      }
    }
    
    return comment;
  }

  async findAllByEntity(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.comment.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      include: {
        author: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, tenantId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, tenantId },
    });

    if (!comment) throw new NotFoundException('Comment not found');
    
    // Only the author or an ADMIN can delete a comment
    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw new NotFoundException('Comment not found or access denied');
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }
}
