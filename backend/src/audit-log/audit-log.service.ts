import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogFilters {
  tableName?: string;
  actionType?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append-only write — DORA Art. 25.
   * This is the ONLY write method. No update or delete methods exist.
   */
  async write(
    tenantId: string,
    userId: string,
    actionType: string,
    tableName: string,
    recordId: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        actionType,
        tableName,
        recordId,
        oldValues: oldValues as any ?? undefined,
        newValues: newValues as any ?? undefined,
      },
    });
  }

  /**
   * Read audit logs for a tenant — filterable by table/action.
   * Paginated — default 50 per page.
   */
  async findAll(tenantId: string, filters: AuditLogFilters = {}) {
    const { tableName, actionType, limit = 50, offset = 0 } = filters;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          ...(tableName ? { tableName } : {}),
          ...(actionType ? { actionType } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
        include: {
          user: { select: { email: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          tenantId,
          ...(tableName ? { tableName } : {}),
          ...(actionType ? { actionType } : {}),
        },
      }),
    ]);

    return { data: logs, total, limit, offset };
  }
}
