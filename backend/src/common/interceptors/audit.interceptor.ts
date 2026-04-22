import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

/** HTTP methods that trigger audit log entries */
const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Tables for which we support pre-fetch of old_values.
 * Only whitelisted tables are queried — this prevents SQL injection via route names.
 * Table names are derived from the route path segment (kebab-case → snake_case).
 */
const OLD_VALUES_TABLES = new Set([
  'contractual_arrangements',
  'financial_entities',
  'ict_providers',
  'ict_services',
  'ict_supply_chain',
  'business_functions',
  'ict_service_assessments',
  'exit_strategies',
  'branches',
  'users',
  'contract_entities',
  'contract_providers',
]);

/**
 * Global audit interceptor — DORA Art. 25 compliance.
 *
 * Fires on every successful CREATE / UPDATE / DELETE request.
 * For PATCH/PUT/DELETE: pre-fetches the current record to capture old_values.
 * Captures:
 *   - tenantId + userId from the JWT payload
 *   - actionType derived from HTTP method
 *   - tableName from the controller route path
 *   - recordId from response body `.id` or route param `:id`
 *   - oldValues: record snapshot BEFORE mutation (PATCH/PUT/DELETE only)
 *   - newValues: response body for CREATE/UPDATE
 *
 * IMPORTANT: Audit log is append-only. This interceptor ONLY writes.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method?.toUpperCase();

    // Only audit mutating operations
    if (!AUDITED_METHODS.has(method) || !request.user) {
      return next.handle();
    }

    const tenantId: string = request.user.tenantId;
    const userId: string = request.user.id ?? request.user.sub ?? 'system';
    const rawPath: string = request.route?.path || request.path || '';
    const tableName = this.deriveTableName(rawPath);
    
    // Only audit recognized business entities
    if (!OLD_VALUES_TABLES.has(tableName)) {
      return next.handle();
    }

    const actionType =
      method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';

    // For mutations on an existing record, pre-fetch before the handler runs
    const recordId = request.params?.id;
    const prefetchPromise = this.prefetch(tableName, recordId, tenantId);

    return from(prefetchPromise).pipe(
      switchMap((oldValues) =>
        next.handle().pipe(
          tap(async (responseBody) => {
            try {
              if (!tenantId || !userId) return;

              const finalRecordId =
                responseBody && typeof responseBody === 'object' && 'id' in responseBody
                  ? String(responseBody.id)
                  : (recordId ?? 'unknown');

              await this.auditLogService.write(
                tenantId,
                userId,
                actionType,
                tableName,
                finalRecordId,
                // oldValues: only meaningful for UPDATE / DELETE
                actionType !== 'CREATE' ? oldValues : undefined,
                // newValues: response body for CREATE/UPDATE
                actionType !== 'DELETE' && responseBody && typeof responseBody === 'object'
                  ? this.sanitize(responseBody)
                  : undefined,
              );
            } catch {
              // Audit log failure must NEVER break the primary request
            }
          }),
        ),
      ),
    );
  }

  /**
   * Pre-fetch the current record state from the DB before mutation.
   * Only runs for UPDATE/DELETE on whitelisted tables with a UUID route param.
   * parameterised rawQuery — tableName validated against whitelist before interpolation.
   */
  private async prefetch(
    tableName: string,
    recordId: string | undefined,
    tenantId: string,
  ): Promise<Record<string, any> | undefined> {
    if (!recordId || !tenantId) return undefined;
    if (!OLD_VALUES_TABLES.has(tableName)) return undefined;
    // UUID validation — prevent path traversal / injection
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) return undefined;

    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM ${tableName} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        recordId,
        tenantId,
      );
      if (rows.length === 0) return undefined;
      return this.sanitize(rows[0]);
    } catch {
      // Table may not have tenant_id (e.g. junction tables) — return nothing rather than fail
      return undefined;
    }
  }

  /** Extract snake_case table name from the route path */
  private deriveTableName(path: string): string {
    // e.g. /api/v1/contractual-arrangements/:id → contractual_arrangements
    const segment = path
      .replace(/^\/api\/v1\//, '')
      .split('/')[0]
      .replace(/-/g, '_');
    return segment || 'unknown';
  }

  /** Remove sensitive fields before storing in audit log */
  private sanitize(body: Record<string, any>): Record<string, any> {
    const {
      passwordHash, password, resetToken, resetTokenExpires,
      password_hash, reset_token, reset_token_expires,
      ...safe
    } = body;
    return safe;
  }
}
