import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface ValidationResult {
  ruleId: string;
  templateName: string;
  fieldName: string;
  ruleType: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  recordId?: string;
  // Full workflow status — must match all possible ValidationIssue statuses
  status?: 'OPEN' | 'FLAGGED' | 'WAITING_APPROVAL' | 'RESOLVED' | 'FIXED';
  entityType?: string;
  entityName?: string;
  flagComment?: string;      // Analyst message when flagged
  editorNote?: string;       // Editor's resolution note
  suggestedAction?: string;
  frontendRoute?: string;
  invalidValue?: string;
  newValue?: string;
  doraArticle?: string;
  errorCategory?: string;
}

export interface ValidationRunSummary {
  runId: string;
  tenantId: string;
  executedAt: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  results: ValidationResult[];
  error?: string;
}

const ALLOWED_TABLES = [
  'contractual_arrangements', 'financial_entities', 'ict_providers',
  'business_functions', 'ict_service_assessments', 'ict_supply_chain',
  'branches', 'entities_using_services', 'exit_strategies', 'ict_services',
  'contract_entities', 'contract_providers',
];

const ALLOWED_REF_TABLES = [
  'countries', 'currencies', 'entity_types', 'criticality_levels',
  'reliance_levels', 'data_sensitivity_levels', 'ict_service_types',
  'provider_person_types',
];

const ENTITY_NAME_FIELDS: Record<string, string> = {
  contractual_arrangements: 'contract_reference', 
  financial_entities:       'lei',
  ict_providers:            'provider_code', 
  business_functions:       'function_name',
  ict_service_assessments:  'id',
  ict_supply_chain:         'id',
  branches:                 'name', 
  entities_using_services:  'id',
  exit_strategies:          'id',
  ict_services:             'service_name',
};

const SUGGESTED_ACTIONS: Record<string, string> = {
  required:       'Fill in this required field and save the record.',
  fk_exists:      'Ensure the referenced entity (provider/contract/entity) exists and is linked correctly.',
  format:         'Check the format — LEI codes must be 20 characters; dates use YYYY-MM-DD.',
  range:          'Ensure the numeric value is within the allowed range.',
  dropdown:       'Select a valid option from the approved reference list.',
  'cross-field':  'Check that start/end dates and dependent fields are logically consistent.',
  conditional:    'A dependent field is missing — fill it in when the related field has this value.',
  date_boundary:  'Update this date — DORA is effective 17 January 2025; dates before this are invalid.',
  uniqueness:     'A duplicate value exists for this field within your organisation. Each entry must be unique.',
  aggregate:      'A minimum data requirement for DORA compliance has not been met for your organisation.',
};

const ERROR_CATEGORIES: Record<string, string> = {
  required:       'Missing Data',
  fk_exists:      'Logical Errors',
  format:         'Format Errors',
  range:          'Logical Errors',
  dropdown:       'Logical Errors',
  'cross-field':  'Logical Errors',
  conditional:    'Regulatory Gaps',
  date_boundary:  'Regulatory Gaps',
  uniqueness:     'Logical Errors',
  aggregate:      'Regulatory Gaps',
};

const TABLE_ROUTES: Record<string, string> = {
  contractual_arrangements: '/contracts',
  financial_entities:       '/entities',
  ict_providers:            '/providers',
  business_functions:       '/functions',
  ict_service_assessments:  '/assessments',
  ict_supply_chain:         '/supply-chain',
  branches:                 '/entities',
  exit_strategies:          '/exit-strategies',
  ict_services:             '/ict-services',
};

type RuleRow = {
  id: string;
  templateName: string;
  fieldName: string;
  ruleType: string;
  ruleValue: string | null;
  errorMessage: string | null;
  severity: string;
  doraArticle?: string | null;
};

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async loadRules(templateName?: string) {
    return this.prisma.validationRule.findMany({
      where: {
        isActive: true,
        ...(templateName ? { templateName } : {}),
      },
      orderBy: { templateName: 'asc' },
    });
  }

  private async getCurrentDbValue(table: string, field: string, recordId: string, tenantId: string): Promise<string | undefined> {
    try {
      const result: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT "${field}"::text as "val" FROM ${table} WHERE id = $1 AND tenant_id = $2`,
        recordId,
        tenantId
      );
      return result.length > 0 ? result[0].val : undefined;
    } catch (e) {
      return undefined;
    }
  }

  async runValidation(tenantId: string): Promise<ValidationRunSummary> {

    try {
      const rules = await this.loadRules();
      const rawResults: ValidationResult[] = [];

      for (const rule of rules) {
        const ruleResults = await this.executeRule(tenantId, rule);
        rawResults.push(...ruleResults);
      }

      const previousRun = await this.prisma.validationRun.findFirst({
        where: { tenantId },
        orderBy: { executedAt: 'desc' },
      });

      const finalResults: ValidationResult[] = [];
      const prevResults = (previousRun?.results as unknown as ValidationResult[]) || [];

      // --- FIX: exclude RESOLVED issues so they are NEVER re-surfaced in a new run.
      // FIXED and RESOLVED issues are permanently closed — do not merge them back.
      const existingIssues = await this.prisma.validationIssue.findMany({
        where: { tenantId, status: { notIn: ['FIXED', 'RESOLVED'] } }
      });

      // --- FIX: build an authoritative set of WAITING_APPROVAL issues from the DB.
      // These must always appear in results regardless of what prevResults JSON contains,
      // because the Editor has submitted a fix and the record may no longer trigger the rule.
      const waitingApprovalIssues = existingIssues.filter(i => i.status === 'WAITING_APPROVAL');

      for (const newResult of rawResults) {
        const issue = existingIssues.find(i => i.ruleId === newResult.ruleId && i.recordId === newResult.recordId);
        if (issue) {
          // Preserve DB status (OPEN, FLAGGED, WAITING_APPROVAL).
          // RESOLVED issues are excluded from existingIssues so they never match here.
          newResult.status = issue.status as any;
          newResult.flagComment = issue.analystMessage || undefined;
          newResult.editorNote = issue.editorResolutionNote || undefined;
        } else {
          newResult.status = 'OPEN';
        }
        finalResults.push(newResult);
      }

      // --- Step 2: handle issues that no longer appear in rawResults (data was changed) ---
      for (const prevResult of prevResults) {
        const stillExists = rawResults.find(
          (n) => n.ruleId === prevResult.ruleId && (n.recordId || '') === (prevResult.recordId || '')
        );

        if (!stillExists) {
          if (prevResult.status === 'OPEN' || prevResult.status === 'FLAGGED') {
            // Rule no longer fires → auto-close as FIXED
            finalResults.push({
              ...prevResult,
              status: 'FIXED',
              message: `[RESOLVED] ${prevResult.message}`,
              severity: 'INFO',
            });
            this.prisma.validationIssue.updateMany({
              where: { tenantId, ruleId: prevResult.ruleId, recordId: prevResult.recordId || '', status: { in: ['OPEN', 'FLAGGED'] } },
              data: { status: 'FIXED', resolvedAt: new Date() }
            }).catch(e => console.error(e));
          }
          // RESOLVED / WAITING_APPROVAL / FIXED from prevResults are handled below — skip silently
        }
      }

      // --- FIX: guarantee WAITING_APPROVAL items are always present in finalResults.
      // They may not appear in rawResults (the Editor fixed the data, so the rule no longer fires)
      // and may not be in prevResults (JSON could be stale). Pull them directly from DB.
      for (const waIssue of waitingApprovalIssues) {
        const alreadyInFinal = finalResults.find(
          r => r.ruleId === waIssue.ruleId && (r.recordId || '') === (waIssue.recordId || '')
        );
        if (!alreadyInFinal) {
          // Reconstruct a result entry from the DB issue + any matching prevResult for context
          const prevMatch = prevResults.find(
            p => p.ruleId === waIssue.ruleId && (p.recordId || '') === (waIssue.recordId || '')
          );
          if (prevMatch) {
            const currentVal = prevMatch.entityType 
              ? await this.getCurrentDbValue(prevMatch.entityType, prevMatch.fieldName, waIssue.recordId, tenantId)
              : undefined;

            finalResults.push({
              ...prevMatch,
              status: 'WAITING_APPROVAL',
              flagComment: waIssue.analystMessage || prevMatch.flagComment,
              editorNote: waIssue.editorResolutionNote || prevMatch.editorNote,
              newValue: currentVal,
            });
          }
          // If there's no prevMatch either, the issue will still be visible from the DB
          // via the ValidationIssue table — no need to reconstruct a full result entry.
        }
      }

      // ── Enhance existing WAITING_APPROVAL in finalResults with newValue ──
      for (const res of finalResults) {
        if (res.status === 'WAITING_APPROVAL' && !res.newValue && res.entityType && res.recordId) {
          res.newValue = await this.getCurrentDbValue(res.entityType, res.fieldName, res.recordId, tenantId);
        }
      }


      // FIXED = closed, RESOLVED = Analyst approved — these do not block export.
      // WAITING_APPROVAL = Editor submitted fix (pending Analyst review) — this STILL counts as an error until approved!
      const totalErrors = finalResults.filter(
        (r) => r.severity === 'ERROR'
          && r.status !== 'FIXED'
          && r.status !== 'RESOLVED'
      ).length;
      const totalWarnings = finalResults.filter((r) => r.severity === 'WARNING').length;
      const totalInfo = finalResults.filter((r) => r.severity === 'INFO').length;

      // ── DORA Score computation ─────────────────────────────────────────────────
      // totalFieldsChecked  = total (rule × record) pairs evaluated
      // totalFieldsPassing  = pairs that did NOT produce an active issue
      // doraScore           = (totalFieldsPassing / totalFieldsChecked) × 100
      const totalRulesExecuted = rules.length;
      const totalFieldsChecked = Math.max(finalResults.length, 1);
      const activeIssueCount = finalResults.filter(
        r => r.status !== 'FIXED' && r.status !== 'RESOLVED'
      ).length;
      const totalFieldsPassing = Math.max(totalFieldsChecked - activeIssueCount, 0);
      const doraScore = finalResults.length === 0
        ? 100
        : Math.round((totalFieldsPassing / totalFieldsChecked) * 100);

      // ── Category Summary — groups active issues by error class ────────────────
      // missingData    : required field violations
      // formatErrors   : regex / date format violations
      // logicalErrors  : conditional, cross-field, range violations
      // regulatoryGaps : FK integrity violations (orphaned references)
      const activeIssues = finalResults.filter(
        r => r.status !== 'FIXED' && r.status !== 'RESOLVED'
      );
      const categorySummary = {
        missingData:    activeIssues.filter(r => r.ruleType === 'required').length,
        formatErrors:   activeIssues.filter(r => r.ruleType === 'format').length,
        logicalErrors:  activeIssues.filter(r =>
          r.ruleType === 'conditional' || r.ruleType === 'cross-field' || r.ruleType === 'range'
        ).length,
        regulatoryGaps: activeIssues.filter(r =>
          r.ruleType === 'fk_exists' || r.ruleType === 'dropdown'
        ).length,
      };

      const run = await this.prisma.validationRun.create({
        data: {
          tenantId,
          totalErrors,
          totalWarnings,
          totalInfo,
          totalRulesExecuted,
          totalFieldsChecked,
          totalFieldsPassing,
          doraScore,
          categorySummary: categorySummary as unknown as any,
          results: finalResults as unknown as any,
        },
      });


      return {
        runId: run.id,
        tenantId,
        executedAt: run.executedAt.toISOString(),
        totalErrors,
        totalWarnings,
        totalInfo,
        results: finalResults,
      };
    } catch (error: any) {
      console.error('[Validation System Fatal Error]:', error);
      return {
        runId: 'error-run',
        tenantId,
        executedAt: new Date().toISOString(),
        totalErrors: 1,
        totalWarnings: 0,
        totalInfo: 0,
        error: `Internal Error Processing Rules: ${error.message}`,
        results: [{
          ruleId: 'sys-error',
          templateName: 'System',
          fieldName: 'Engine',
          ruleType: 'sys',
          severity: 'ERROR',
          errorCategory: 'System Crash',
          message: `Validation Engine crashed (Database constraints or Syntax Error): ${error.message}. Please contact support.`
        }]
      }
    }
  }

  async flagIssue(tenantId: string, runId: string, ruleId: string, recordId: string, comment?: string, flaggedByUserId?: string) {
    const run = await this.prisma.validationRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error('Validation run not found');
    
    // Locate the result to get tableName and fieldName
    const results = run.results as unknown as ValidationResult[];
    const ruleRes = results.find(r => r.ruleId === ruleId && r.recordId === recordId);
    const tableName = ruleRes?.entityType || 'unknown';
    const fieldName = ruleRes?.fieldName || 'unknown';

    // Store in DB explicitly
    const existing = await this.prisma.validationIssue.findFirst({
      where: { tenantId, ruleId, recordId, status: { in: ['OPEN', 'FLAGGED'] } }
    });

    let issueId: string;
    if (existing) {
      await this.prisma.validationIssue.update({
        where: { id: existing.id },
        data: { status: 'FLAGGED', analystMessage: comment || existing.analystMessage, flaggedBy: flaggedByUserId || existing.flaggedBy }
      });
      issueId = existing.id;
    } else {
      const created = await this.prisma.validationIssue.create({
        data: {
          tenantId,
          runId,
          ruleId,
          recordId,
          tableName,
          fieldName,
          analystMessage: comment,
          status: 'FLAGGED',
          flaggedBy: flaggedByUserId,
        }
      });
      issueId = created.id;
      // Deep-link includes openId + fieldKey so Editor's browser auto-opens the record
      const recordRoute = TABLE_ROUTES[tableName] || '/';
      const deepLink = recordId
        ? `${recordRoute}?highlight=${recordId}&openId=${recordId}&fieldKey=${encodeURIComponent(fieldName)}`
        : recordRoute;
      // Push Notification to Editor
      await this.notifications.createNotification({
        tenantId,
        roleName: 'EDITOR',
        title: '🚩 New Issue Flagged by Analyst',
        message: `Analyst flagged "${fieldName}" on a ${tableName} record. Click to open the record directly.`,
        link: deepLink
      });
    }

    // Audit log entry
    if (flaggedByUserId) {
      this.auditLog.write(
        tenantId, flaggedByUserId,
        'ISSUE_FLAGGED', 'validation_issues', issueId,
        { status: existing?.status || 'OPEN' },
        { status: 'FLAGGED', fieldName, tableName, comment: comment || null },
      ).catch(e => console.error('[AuditLog] flagIssue failed:', e));
    }

    ruleRes!.status = 'FLAGGED';
    ruleRes!.flagComment = comment;
    await this.prisma.validationRun.update({
      where: { id: runId },
      data: { results: results as unknown as any },
    });

    return { success: true };
  }

  /**
   * Editor submits a fix — sets status to WAITING_APPROVAL.
   * The Analyst must then explicitly approve or reject.
   */
  async resolveIssue(tenantId: string, runId: string, ruleId: string, recordId: string, note?: string, editorUserId?: string) {
    const run = await this.prisma.validationRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error('Validation run not found');

    // 1. Capture previous state for audit
    const prevIssue = await this.prisma.validationIssue.findFirst({
      where: { tenantId, ruleId, recordId, status: { in: ['OPEN', 'FLAGGED'] } }
    });
    const prevStatus = prevIssue?.status || 'FLAGGED';

    // 2. Update the DB issue record
    await this.prisma.validationIssue.updateMany({
      where: { tenantId, ruleId, recordId, status: { in: ['OPEN', 'FLAGGED'] } },
      data: {
        status: 'WAITING_APPROVAL',
        editorResolutionNote: note ?? 'Editor submitted fix — awaiting Analyst approval.',
        fixedBy: editorUserId,
        fixedAt: new Date(),
      }
    });

    // 3. *** CRITICAL: Update JSON result to WAITING_APPROVAL (NOT FIXED) ***
    const results = run.results as unknown as ValidationResult[];
    const ruleRes = results.find(r => r.ruleId === ruleId && (r.recordId || '') === (recordId || ''));
    const fieldName = ruleRes?.fieldName || 'unknown';
    const tableName = ruleRes?.entityType || 'unknown';
    if (ruleRes) {
      ruleRes.status = 'WAITING_APPROVAL';
      ruleRes.editorNote = note;
    }

    await this.prisma.validationRun.update({
      where: { id: runId },
      data: { results: results as unknown as any },
    });

    // 4. Audit log
    if (editorUserId && prevIssue) {
      this.auditLog.write(
        tenantId, editorUserId,
        'ISSUE_MARK_FIXED', 'validation_issues', prevIssue.id,
        { status: prevStatus },
        { status: 'WAITING_APPROVAL', note: note || null, fieldName, tableName },
      ).catch(e => console.error('[AuditLog] resolveIssue failed:', e));
    }

    // 5. Notify Analyst
    await this.notifications.createNotification({
      tenantId,
      roleName: 'ANALYST',
      title: '✅ Editor Fix Awaiting Your Approval',
      message: `An Editor submitted a fix for "${fieldName}" — please review and approve or reject.`,
      link: '/validation'
    });

    return { success: true, status: 'WAITING_APPROVAL' };
  }

  /**
   * Analyst approves an Editor fix — sets status to RESOLVED.
   */
  async approveIssue(tenantId: string, runId: string, ruleId: string, recordId: string, analystUserId?: string) {
    const run = await this.prisma.validationRun.findFirst({ where: { id: runId, tenantId } });

    // Capture issue for audit
    const issueToApprove = await this.prisma.validationIssue.findFirst({
      where: { tenantId, ruleId, recordId, status: 'WAITING_APPROVAL' }
    });

    await this.prisma.validationIssue.updateMany({
      where: { tenantId, ruleId, recordId, status: 'WAITING_APPROVAL' },
      data: { status: 'RESOLVED', resolvedAt: new Date() }
    });

    // Update JSON run result to RESOLVED
    let fieldName = 'unknown';
    let entityType = 'unknown';
    if (run) {
      const results = run.results as unknown as ValidationResult[];
      for (const r of results) {
        if (r.ruleId === ruleId && (r.recordId || '') === (recordId || '')) {
          r.status = 'RESOLVED';
          fieldName = r.fieldName || 'unknown';
          entityType = r.entityType || 'unknown';
          break;
        }
      }
      await this.prisma.validationRun.update({
        where: { id: runId },
        data: { results: (run.results as any) },
      });
    }

    // Audit log
    if (analystUserId && issueToApprove) {
      this.auditLog.write(
        tenantId, analystUserId,
        'ISSUE_APPROVED', 'validation_issues', issueToApprove.id,
        { status: 'WAITING_APPROVAL' },
        { status: 'RESOLVED', fieldName, entityType },
      ).catch(e => console.error('[AuditLog] approveIssue failed:', e));
    }

    // Notify the Editor — deep-link to resolved record
    const baseRoute = TABLE_ROUTES[entityType] || '/';
    const approvedRoute = recordId ? `${baseRoute}?highlight=${recordId}` : baseRoute;
    await this.notifications.createNotification({
      tenantId,
      roleName: 'EDITOR',
      title: '✅ Fix Approved by Analyst',
      message: `Your submitted fix for "${fieldName}" was approved. The issue is now fully resolved.`,
      link: approvedRoute
    });

    return { success: true, status: 'RESOLVED' };
  }

  /**
   * Analyst rejects an Editor fix — resets to FLAGGED so Editor must try again.
   */
  async rejectIssue(tenantId: string, runId: string, ruleId: string, recordId: string, reason?: string, analystUserId?: string) {
    const run = await this.prisma.validationRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new Error('Validation run not found');

    // Capture issue for audit
    const issueToReject = await this.prisma.validationIssue.findFirst({
      where: { tenantId, ruleId, recordId, status: 'WAITING_APPROVAL' }
    });

    await this.prisma.validationIssue.updateMany({
      where: { tenantId, ruleId, recordId, status: 'WAITING_APPROVAL' },
      data: {
        status: 'FLAGGED',
        analystMessage: reason ?? 'Fix rejected by Analyst — please review and try again.'
      }
    });

    // Restore run result to FLAGGED
    const results = run.results as unknown as ValidationResult[];
    const rejectedResult = results.find(x => x.ruleId === ruleId && (x.recordId || '') === (recordId || ''));
    const fieldName = rejectedResult?.fieldName || 'unknown';
    const entityType = rejectedResult?.entityType || 'unknown';
    if (rejectedResult) {
      rejectedResult.status = 'FLAGGED';
      rejectedResult.flagComment = reason;
    }
    await this.prisma.validationRun.update({
      where: { id: runId },
      data: { results: results as unknown as any }
    });

    // Audit log
    if (analystUserId && issueToReject) {
      this.auditLog.write(
        tenantId, analystUserId,
        'ISSUE_REJECTED', 'validation_issues', issueToReject.id,
        { status: 'WAITING_APPROVAL' },
        { status: 'FLAGGED', reason: reason || null, fieldName, entityType },
      ).catch(e => console.error('[AuditLog] rejectIssue failed:', e));
    }

    // Notify Editor — deep-link back to record with openId+fieldKey for auto-open
    const baseRoute = TABLE_ROUTES[entityType] || '/';
    const rejectedRoute = recordId
      ? `${baseRoute}?highlight=${recordId}&openId=${recordId}&fieldKey=${encodeURIComponent(fieldName)}`
      : baseRoute;
    await this.notifications.createNotification({
      tenantId,
      roleName: 'EDITOR',
      title: '❌ Fix Rejected — Please Resubmit',
      message: reason ?? `Analyst rejected your fix for "${fieldName}". Click to open the record and correct it.`,
      link: rejectedRoute
    });

    return { success: true, status: 'FLAGGED' };
  }

  async getRunHistory(tenantId: string) {
    return this.prisma.validationRun.findMany({
      where: { tenantId },
      orderBy: { executedAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        executedAt: true,
        totalErrors: true,
        totalWarnings: true,
        totalInfo: true,
      },
    });
  }

  async getRunById(runId: string, tenantId: string) {
    return this.prisma.validationRun.findFirst({
      where: { id: runId, tenantId },
    });
  }

  // ---------------------------------------------------------------------------
  // Rule dispatcher
  // ---------------------------------------------------------------------------
  private async executeRule(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    try {
      switch (rule.ruleType) {
        case 'required':       return await this.checkRequired(tenantId, rule);
        case 'fk_exists':      return await this.checkFkExists(tenantId, rule);
        case 'format':         return await this.checkFormat(tenantId, rule);
        case 'range':          return await this.checkRange(tenantId, rule);
        case 'dropdown':       return await this.checkDropdown(tenantId, rule);
        case 'cross-field':    return await this.checkCrossField(tenantId, rule);
        case 'conditional':    return await this.checkConditional(tenantId, rule);
        case 'date_boundary':  return await this.checkDateBoundary(tenantId, rule);
        case 'uniqueness':     return await this.checkUniqueness(tenantId, rule);
        case 'aggregate':      return await this.checkAggregate(tenantId, rule);
        default: return [];
      }
    } catch (error: any) {
      console.error(`[Validation Rule Execution Failed] Rule: ${rule.ruleType} | Template: ${rule.templateName}`, error.message);
      return []; 
    }
  }

  private normalizeSeverity(raw: string): 'ERROR' | 'WARNING' | 'INFO' {
    const upper = raw?.toUpperCase();
    if (upper === 'WARNING') return 'WARNING';
    if (upper === 'INFO') return 'INFO';
    return 'ERROR';
  }

  private makeResult(
    rule: RuleRow,
    recordId: string,
    ruleType?: string,
    extras?: { entityType?: string; entityName?: string; invalidValue?: string },
  ): ValidationResult {
    const resolvedRuleType = ruleType || rule.ruleType;
    const entityType = extras?.entityType || this.resolveTable(rule.templateName) || undefined;
    // Deep-link includes openId (auto-open dialog) and fieldKey (show hint inside form)
    const frontendRoute = entityType && TABLE_ROUTES[entityType]
      ? `${TABLE_ROUTES[entityType]}?highlight=${recordId}&openId=${recordId}&fieldKey=${encodeURIComponent(rule.fieldName)}`
      : undefined;
    
    let generatedDoraArticle = rule.doraArticle;
    if (!generatedDoraArticle) {
       if (rule.templateName.includes('01')) generatedDoraArticle = 'DORA Art. 28';
       if (rule.templateName.includes('02')) generatedDoraArticle = 'DORA Art. 30';
       if (rule.templateName.includes('04')) generatedDoraArticle = 'DORA Art. 29';
       if (rule.templateName.includes('05') || rule.templateName.includes('06') || rule.templateName.includes('07')) generatedDoraArticle = 'DORA Art. 28';
    }

    const baseMessage = rule.errorMessage ?? `"${rule.fieldName}" is invalid on this record.`;
    const message = generatedDoraArticle ? `${baseMessage} (${generatedDoraArticle})` : baseMessage;

    return {
      ruleId: rule.id,
      templateName: rule.templateName,
      fieldName: rule.fieldName,
      ruleType: resolvedRuleType,
      errorCategory: ERROR_CATEGORIES[resolvedRuleType] || 'Logical Errors',
      severity: this.normalizeSeverity(rule.severity),
      message: message,
      recordId,
      entityType,
      entityName: extras?.entityName,
      frontendRoute,
      doraArticle: generatedDoraArticle || undefined,
      invalidValue: extras?.invalidValue,
      suggestedAction: SUGGESTED_ACTIONS[resolvedRuleType] ?? 'Review this record and correct the flagged field.',
    };
  }

  private async checkRequired(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    const tableName = rule.ruleValue;
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) return [];
    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';

    // Boolean/integer/date fields use IS NULL only; text fields also check for empty string
    const textTables = ['financial_entities', 'ict_providers', 'contractual_arrangements', 'business_functions', 'ict_service_assessments', 'branches'];
    const textFields = ['name', 'legal_name', 'latin_name', 'contract_reference', 'contract_type', 'function_name', 'function_identifier', 'licensed_activity', 'impact_discontinuation', 'substitution_reason', 'discontinuation_impact', 'provider_code'];
    const isTextField = textTables.includes(tableName) && textFields.includes(rule.fieldName);

    const nullCheck = isTextField
      ? `("${rule.fieldName}" IS NULL OR TRIM("${rule.fieldName}"::text) = '')`
      : `"${rule.fieldName}" IS NULL`;

    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name, 'Missing (null or empty)' as _val FROM ${tableName} WHERE tenant_id = $1 AND ${nullCheck}`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'required', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val
    }));
  }

  private async checkFkExists(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const parts = rule.ruleValue.split('→');
    if (parts.length !== 2) return [];

    const [src, tgt] = parts;
    const [srcTable, srcCol] = src.split('.');
    const [tgtTable, tgtCol] = tgt.split('.');
    if (!ALLOWED_TABLES.includes(srcTable) || ![...ALLOWED_TABLES, ...ALLOWED_REF_TABLES].includes(tgtTable)) return [];
    const nameCol = ENTITY_NAME_FIELDS[srcTable] || 'id';

    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT s.id, s."${nameCol}"::text as _name, s."${srcCol}"::text as _val FROM ${srcTable} s
       LEFT JOIN ${tgtTable} t ON s."${srcCol}" = t."${tgtCol}"
       WHERE s.tenant_id = $1 AND s."${srcCol}" IS NOT NULL AND t."${tgtCol}" IS NULL`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'fk_exists', {
      entityType: srcTable,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val
    }));
  }

  private async checkFormat(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const tableName = this.resolveTable(rule.templateName);
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) return [];

    if (rule.ruleValue === 'date') return [];

    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';
    const records: Array<{ id: string; val: string; _name: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${rule.fieldName}"::text as val, "${nameCol}"::text as _name FROM ${tableName}
       WHERE tenant_id = $1 AND "${rule.fieldName}" IS NOT NULL
       AND "${rule.fieldName}"::text !~ $2`,
      tenantId,
      rule.ruleValue,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'format', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec.val
    }));
  }

  private async checkRange(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const tableName = this.resolveTable(rule.templateName);
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) return [];

    const [minStr, maxStr] = rule.ruleValue.split('|');
    const conditions: string[] = [];

    if (minStr !== '' && minStr !== undefined) {
      conditions.push(`CAST("${rule.fieldName}" AS numeric) < ${Number(minStr)}`);
    }
    if (maxStr !== '' && maxStr !== undefined) {
      conditions.push(`CAST("${rule.fieldName}" AS numeric) > ${Number(maxStr)}`);
    }
    if (conditions.length === 0) return [];

    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';
    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name, "${rule.fieldName}"::text as _val FROM ${tableName}
       WHERE tenant_id = $1 AND "${rule.fieldName}" IS NOT NULL
       AND (${conditions.join(' OR ')})`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'range', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val
    }));
  }

  private async checkDropdown(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const tableName = this.resolveTable(rule.templateName);
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) return [];

    const [refTable, refCol] = rule.ruleValue.split('.');
    if (!ALLOWED_REF_TABLES.includes(refTable)) return [];

    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';
    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT d.id, d."${nameCol}"::text as _name, d."${rule.fieldName}"::text as _val FROM ${tableName} d
       LEFT JOIN ${refTable} r ON d."${rule.fieldName}"::text = r."${refCol}"::text
       WHERE d.tenant_id = $1 AND d."${rule.fieldName}" IS NOT NULL AND r."${refCol}" IS NULL`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'dropdown', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val
    }));
  }

  private async checkCrossField(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const parts = rule.ruleValue.split('>');
    if (parts.length !== 2) return [];

    const [leftPart, rightPart] = parts;
    const [tableName, leftCol] = leftPart.split('.');
    const rightCol = rightPart.split('.')[1] || rightPart;
    if (!ALLOWED_TABLES.includes(tableName)) return [];

    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';
    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name, ("${leftCol}"::text || ' <= ' || "${rightCol}"::text) as _val FROM ${tableName}
       WHERE tenant_id = $1
       AND "${leftCol}" IS NOT NULL AND "${rightCol}" IS NOT NULL
       AND "${leftCol}" <= "${rightCol}"`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'cross-field', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val
    }));
  }

  private async checkConditional(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const arrowParts = rule.ruleValue.split('→');
    if (arrowParts.length !== 2) return [];

    const [condPart, actionPart] = arrowParts;
    const eqParts = condPart.split('=');
    if (eqParts.length !== 2) return [];

    const [tableField, condValue] = eqParts;
    const [tableName, condCol] = tableField.split('.');
    const targetField = actionPart.split('.')[0];
    if (!ALLOWED_TABLES.includes(tableName)) return [];

    let condSql: string;
    if (condValue === 'true') condSql = `"${condCol}" = true`;
    else if (condValue === 'false') condSql = `"${condCol}" = false`;
    else condSql = `"${condCol}"::text = '${condValue}'`;

    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';
    const records: Array<{ id: string; _name: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name FROM ${tableName}
       WHERE tenant_id = $1 AND ${condSql} AND "${targetField}" IS NULL`,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'conditional', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: `Missing ${targetField} (because ${condCol}='${condValue}')`
    }));
  }

  /**
   * date_boundary — field must be >= ruleValue date string (ISO format).
   * ruleValue format: "YYYY-MM-DD"  (e.g. "2025-01-17")
   */
  private async checkDateBoundary(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const tableName = this.resolveTable(rule.templateName);
    if (!tableName || !ALLOWED_TABLES.includes(tableName)) return [];
    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';

    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name, "${rule.fieldName}"::text as _val
       FROM ${tableName}
       WHERE tenant_id = $1
         AND "${rule.fieldName}" IS NOT NULL
         AND "${rule.fieldName}"::date < $2::date`,
      tenantId,
      rule.ruleValue,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'date_boundary', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val,
    }));
  }

  /**
   * uniqueness — no two rows in a table may share the same field value within the same tenant.
   * ruleValue format: "table.field"  (e.g. "financial_entities.lei")
   * Returns one result per duplicate record (all records involved, not just the second).
   */
  private async checkUniqueness(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const [tableName, fieldName] = rule.ruleValue.split('.');
    if (!ALLOWED_TABLES.includes(tableName)) return [];
    const nameCol = ENTITY_NAME_FIELDS[tableName] || 'id';

    const records: Array<{ id: string; _name: string; _val: string }> = await this.prisma.$queryRawUnsafe(
      `SELECT id, "${nameCol}"::text as _name, "${fieldName}"::text as _val
       FROM ${tableName}
       WHERE tenant_id = $1
         AND "${fieldName}" IS NOT NULL
         AND "${fieldName}" IN (
           SELECT "${fieldName}"
           FROM ${tableName}
           WHERE tenant_id = $1
           GROUP BY "${fieldName}"
           HAVING COUNT(*) > 1
         )`,
      tenantId,
      tenantId,
    );
    return records.map((rec) => this.makeResult(rule, rec.id, 'uniqueness', {
      entityType: tableName,
      entityName: rec._name || rec.id.slice(0, 8),
      invalidValue: rec._val,
    }));
  }

  /**
   * aggregate — tenant-level existence check. Fires a single issue against a placeholder
   * record ID ('00000000-0000-0000-0000-000000000000') when the aggregate condition is not met.
   * ruleValue format: "table:min_count"  (e.g. "ict_providers:1")
   */
  private async checkAggregate(tenantId: string, rule: RuleRow): Promise<ValidationResult[]> {
    if (!rule.ruleValue) return [];
    const [tableName, minCountStr] = rule.ruleValue.split(':');
    if (!ALLOWED_TABLES.includes(tableName)) return [];
    const minCount = parseInt(minCountStr ?? '1', 10);

    const result: Array<{ cnt: bigint }> = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM ${tableName} WHERE tenant_id = $1`,
      tenantId,
    );
    const count = Number(result[0]?.cnt ?? 0);
    if (count >= minCount) return [];

    // Emit a single tenant-level issue with a sentinel recordId
    const syntheticRecordId = '00000000-0000-0000-0000-000000000000';
    return [this.makeResult(rule, syntheticRecordId, 'aggregate', {
      entityType: tableName,
      entityName: 'Tenant-level check',
      invalidValue: `Found ${count}, required ≥ ${minCount}`,
    })];
  }

  private resolveTable(templateName: string): string | null {
    const map: Record<string, string> = {
      'RT.01.01': 'financial_entities',
      'RT.01.02': 'financial_entities',
      'RT.01.03': 'branches',
      'RT.02.01': 'contractual_arrangements',
      'RT.02.02': 'contractual_arrangements',
      'RT.03.01': 'contract_entities',
      'RT.04.01': 'entities_using_services',
      'RT.05.01': 'ict_providers',
      'RT.05.02': 'ict_supply_chain',
      'RT.05':    'ict_services',
      'RT.06.01': 'business_functions',
      'RT.07.01': 'ict_service_assessments',
      'RT.08':    'exit_strategies',
    };
    return map[templateName] || null;
  }
}
