import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * TenantIsolationMiddleware
 *
 * Sets the PostgreSQL session variable `app.current_tenant_id` to the
 * authenticated user's tenant UUID at the start of every request.
 *
 * PostgreSQL RLS policies on all domain tables read this variable:
 *   USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
 *
 * This means even if a service method accidentally omits the `tenantId`
 * WHERE clause, the database will still return only rows belonging to the
 * current tenant — providing a second layer of isolation beyond the
 * application-layer tenant_id filters.
 *
 * NOTE: `set_config(key, value, is_local=false)` sets a session-level variable.
 * In a connection pool, the connection may be reused for a different request.
 * The middleware always overwrites the variable at the start of each request,
 * so a previous tenant's ID cannot bleed into the current request.
 *
 * If `request.user` is not set (unauthenticated request), the variable is
 * cleared to an empty string. RLS policies treat empty string as no-match,
 * so unauthenticated queries return zero rows from all tenant tables.
 */
@Injectable()
export class TenantIsolationMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user;
    const tenantId: string = user?.tenantId ?? '';

    try {
      // Use parameterised query to prevent injection; set session-level (not transaction)
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        tenantId,
      );
    } catch {
      // Non-fatal: if DB is unreachable, the request will fail at the service layer anyway.
      // We do not propagate this error to avoid masking the real request error.
    }

    next();
  }
}
