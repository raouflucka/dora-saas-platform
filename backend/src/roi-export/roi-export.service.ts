import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';

import * as ExcelJS from 'exceljs';
import archiver from 'archiver';
import { PassThrough } from 'stream';

/** Supported EBA RT templates */
export const SUPPORTED_TEMPLATES = [
  'RT.01.01', 'RT.01.02', 'RT.01.03',
  'RT.02.01', 'RT.02.02',
  'RT.03.01',
  'RT.04.01',
  'RT.05.01', 'RT.05.02',
  'RT.06.01', 'RT.07.01',
  'RT.08.01',
  'RT.09.01',
] as const;

export type TemplateName = typeof SUPPORTED_TEMPLATES[number];

@Injectable()
export class RoiExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
  ) {}

  /** Pre-flight check — reads the latest saved run; does NOT trigger a new validation run */
  async preflight(tenantId: string) {
    const latestRun = await this.prisma.validationRun.findFirst({
      where: { tenantId },
      orderBy: { executedAt: 'desc' },
    });

    if (!latestRun) {
      throw new BadRequestException({
        message: 'No validation run found. Please run validation before exporting.',
        runId: null,
        totalErrors: 0,
        totalWarnings: 0,
      });
    }

    // Re-derive totalErrors from the JSON results using the same logic as the engine:
    // WAITING_APPROVAL = Editor submitted fix (not blocking), RESOLVED/FIXED = closed.
    const results = (latestRun.results as unknown as Array<{ severity?: string; status?: string }>) || [];
    const totalErrors = results.filter(
      r => r.severity === 'ERROR'
        && r.status !== 'FIXED'
        && r.status !== 'RESOLVED'
        && r.status !== 'WAITING_APPROVAL'
    ).length;

    if (totalErrors > 0) {
      throw new BadRequestException({
        message: `Export blocked: ${totalErrors} validation error(s) must be resolved first.`,
        runId: latestRun.id,
        totalErrors,
        totalWarnings: latestRun.totalWarnings,
      });
    }

    return {
      runId: latestRun.id,
      totalErrors: 0,
      totalWarnings: latestRun.totalWarnings,
    };
  }

  /** Generate a full RoI workbook containing all templates for this tenant */
  async generateWorkbook(tenantId: string): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DORA SaaS';
    wb.created = new Date();

    for (const tpl of SUPPORTED_TEMPLATES) {
      await this.addSheet(wb, tpl, tenantId);
    }
    return wb;
  }

  /** Generate a single-template workbook */
  async generateSingleTemplate(tenantId: string, template: TemplateName): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DORA SaaS';
    wb.created = new Date();
    await this.addSheet(wb, template, tenantId);
    return wb;
  }

  /**
   * Generate XBRL OIM-CSV package as a ZIP buffer.
   * Contains one CSV per template plus a metadata.json.
   * Naming follows EBA OIM-CSV convention: RT_XX_XX.csv
   */
  async generateXbrlZip(tenantId: string): Promise<Buffer> {
    // Determine the reporting entity (the primary Financial Entity for this tenant)
    const primaryEntity = await this.prisma.financialEntity.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    
    // EBA register reference date = last day of the previous calendar year
    // (the date up to which the register data is valid, per EBA ITS Art. 2)
    const now = new Date();
    const refYear = now.getMonth() === 0 ? now.getFullYear() - 2 : now.getFullYear() - 1;
    const reportingPeriodDate = `${refYear}-12-31`;
    const submissionDate = now.toISOString().split('T')[0];

    const metadata = {
      // DORA RoI XBRL taxonomy — EBA ITS on Registers of Information (EBA/ITS/2023/02)
      // Note: confirm exact URI from EBA DORA taxonomy package when available
      schemaRef: 'https://www.eba.europa.eu/xbrl/dora/dict/cor',
      reportingPeriod: reportingPeriodDate,
      entityName: primaryEntity?.name || 'Unknown Entity',
      entityLei: (primaryEntity?.lei || '').trim(),  // trim CHAR(20) padding
      submissionDate: submissionDate,
      templates: SUPPORTED_TEMPLATES.map(t => ({
        templateCode: t,
        fileName: `${t.replace(/\./g, '_')}.csv`,
      })),
    };

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const passthrough = new PassThrough();
      passthrough.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', reject);
      archive.pipe(passthrough);

      // Add metadata.json first
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      // Process templates sequentially then finalize
      const processTemplates = async () => {
        for (const tpl of SUPPORTED_TEMPLATES) {
          const csv = await this.templateToCsv(tpl, tenantId);
          const fileName = `${tpl.replace(/\./g, '_')}.csv`;
          archive.append(csv, { name: fileName });
        }
        await archive.finalize();
      };

      processTemplates().catch(reject);
    });
  }

  // ---------------------------------------------------------------------------
  // Sheet builder — dispatches to the correct data mapper
  // ---------------------------------------------------------------------------
  private async addSheet(wb: ExcelJS.Workbook, template: TemplateName, tenantId: string) {
    const mapping = TEMPLATE_DEFS[template];
    if (!mapping) return;

    const ws = wb.addWorksheet(template);

    // Header row: EBA column codes
    const codeRow = ws.addRow(mapping.columns.map(c => c.code));
    codeRow.font = { bold: true, size: 9, color: { argb: 'FF333333' } };
    codeRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };

    // Second row: column names
    const nameRow = ws.addRow(mapping.columns.map(c => c.name));
    nameRow.font = { italic: true, size: 8, color: { argb: 'FF666666' } };

    // Set column widths
    mapping.columns.forEach((col, i) => {
      ws.getColumn(i + 1).width = Math.max(col.name.length + 2, 18);
    });

    // Fetch and write data rows
    const rows = await this.fetchData(template, tenantId);
    for (const row of rows) {
      const values = mapping.columns.map(col => col.extract(row));
      ws.addRow(values);
    }
  }

  /** Convert a template to a CSV string (EBA OIM-CSV format: codes header + data rows) */
  private async templateToCsv(template: TemplateName, tenantId: string): Promise<string> {
    const mapping = TEMPLATE_DEFS[template];
    if (!mapping) return '';

    const lines: string[] = [];

    // Row 1: EBA column codes
    lines.push(mapping.columns.map(c => this.csvEscape(c.code)).join(','));
    // Row 2: human-readable names (OIM-CSV convention — comment row)
    lines.push(mapping.columns.map(c => this.csvEscape(c.name)).join(','));

    // Data rows
    const rows = await this.fetchData(template, tenantId);
    for (const row of rows) {
      const values = mapping.columns.map(col => this.csvEscape(this.formatCsvValue(col.extract(row))));
      lines.push(values.join(','));
    }

    return lines.join('\r\n');
  }

  /**
   * Type-aware value formatter for OIM-CSV cells.
   * - Dates  → YYYY-MM-DD (ISO 8601, no time component)
   * - Booleans → "true" / "false" (EBA OIM boolean representation)
   * - Numbers  → plain decimal string, no locale formatting
   * - null/undefined → empty string (absent optional value)
   * - Strings → trimmed (removes CHAR(N) padding from PostgreSQL)
   */
  private formatCsvValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return val.toString();
    return String(val).trim();
  }

  private csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  // ---------------------------------------------------------------------------
  // Data fetchers — one query per template
  // ---------------------------------------------------------------------------
  private async fetchData(template: TemplateName, tenantId: string): Promise<any[]> {
    switch (template) {
      case 'RT.01.01':
        return this.fetchRT0101(tenantId);
      case 'RT.01.02':
        return this.fetchRT0102(tenantId);
      case 'RT.01.03':
        return this.fetchRT0103(tenantId);
      case 'RT.02.01':
        return this.fetchRT0201(tenantId);
      case 'RT.02.02':
        return this.fetchRT0202(tenantId);
      case 'RT.03.01':
        return this.fetchRT0301(tenantId);
      case 'RT.04.01':
        return this.fetchRT0401(tenantId);
      case 'RT.05.01':
        return this.fetchRT0501(tenantId);
      case 'RT.05.02':
        return this.fetchRT0502(tenantId);
      case 'RT.06.01':
        return this.fetchRT0601(tenantId);
      case 'RT.07.01':
        return this.fetchRT0701(tenantId);
      case 'RT.08.01':
        return this.fetchRT0801(tenantId);
      case 'RT.09.01':
        return this.fetchRT0901(tenantId);
      default:
        return [];
    }
  }

  private async fetchRT0101(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return [];
    const entity = await this.prisma.financialEntity.findFirst({
      where: { tenantId },
      include: { entityType: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!entity) return [];
    return [{ ...entity, _tenant: tenant }];
  }

  private async fetchRT0102(tenantId: string) {
    return this.prisma.financialEntity.findMany({
      where: { tenantId },
      include: { entityType: true, parentEntity: true },
    });
  }

  private async fetchRT0103(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      include: { financialEntity: true },
    });
  }

  private async fetchRT0201(tenantId: string) {
    return this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      include: { financialEntity: true },
    });
  }

  private async fetchRT0202(tenantId: string) {
    return this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      include: {
        financialEntity: true,
        provider: true,
        ictServiceType: true,
        relianceLevel: true,
        dataSensitivity: true,
      },
    });
  }

  /**
   * RT.03.01 — Group-level contract coverage (DORA Art. 29)
   * Each row = one financial entity or branch that is party to a contract
   * Sources: contract_entities (financial entities) + contract_providers (providers)
   */
  private async fetchRT0301(tenantId: string) {
    // Fetch all contract-entity links for this tenant, enriched with contract and entity data
    const contractEntities = await this.prisma.contractEntity.findMany({
      where: {
        contract: { tenantId },
      },
      include: {
        contract: {
          include: {
            ictServiceType: true,
            provider: true,
          },
        },
        financialEntity: true,
      },
    });

    // Also fetch contract-provider links to show the provider side
    const contractProviders = await this.prisma.contractProvider.findMany({
      where: {
        contract: { tenantId },
      },
      include: {
        contract: {
          include: { ictServiceType: true },
        },
        provider: true,
      },
    });

    // Combine into unified rows with _type discriminator
    const entityRows = contractEntities.map(ce => ({
      _type: 'entity',
      contractReference: ce.contract.contractReference,
      entityLei: ce.financialEntity.lei,
      entityName: ce.financialEntity.name,
      providerCode: ce.contract.provider?.lei || ce.contract.provider?.providerCode || '',
      providerCodeType: ce.contract.provider?.lei ? 'LEI' : 'Other',
      ictServiceType: ce.contract.ictServiceType?.name || '',
      startDate: ce.contract.startDate,
    }));

    const providerRows = contractProviders.map(cp => ({
      _type: 'provider',
      contractReference: cp.contract.contractReference,
      entityLei: '',
      entityName: cp.provider.legalName || '',
      providerCode: cp.provider.lei || cp.provider.providerCode,
      providerCodeType: cp.provider.lei ? 'LEI' : 'Other',
      ictServiceType: cp.contract.ictServiceType?.name || '',
      startDate: cp.contract.startDate,
    }));

    // Return entity rows first, then provider rows
    return [...entityRows, ...providerRows];
  }

  /**
   * RT.04.01 — Branch-level service usage (DORA Art. 29)
   * Each row = one (entity or branch) ↔ contract link
   * Source: entities_using_services
   */
  private async fetchRT0401(tenantId: string) {
    return this.prisma.entitiesUsingService.findMany({
      where: {
        contract: { tenantId },
      },
      include: {
        contract: {
          include: {
            ictServiceType: true,
            provider: true,
          },
        },
        financialEntity: true,
        branch: true,
      },
    });
  }

  private async fetchRT0501(tenantId: string) {
    return this.prisma.ictProvider.findMany({
      where: { tenantId },
      include: { personType: true },
    });
  }

  private async fetchRT0502(tenantId: string) {
    return this.prisma.ictSupplyChain.findMany({
      where: { contractualArrangement: { tenantId } },
      include: {
        contractualArrangement: true,
        provider: true,
        parentLink: { include: { provider: true } },
        serviceType: true,
      },
    });
  }

  private async fetchRT0601(tenantId: string) {
    return this.prisma.businessFunction.findMany({
      where: { tenantId },
      include: { financialEntity: true, criticalityLevel: true },
    });
  }

  private async fetchRT0701(tenantId: string) {
    return this.prisma.ictServiceAssessment.findMany({
      where: { tenantId },
      include: { contract: { include: { ictServiceType: true } }, provider: true },
    });
  }

  /**
   * RT.08.01 — Exit strategies per contract (DORA Art. 28§8)
   * One row per exit strategy
   */
  private async fetchRT0801(tenantId: string) {
    return this.prisma.exitStrategy.findMany({
      where: { tenantId },
      include: {
        contract: {
          include: {
            provider: true,
            ictServiceType: true,
            financialEntity: true,
          },
        },
        fallbackProvider: true,
        assessment: true,
      },
    });
  }

  /**
   * RT.09.01 — Concentration Risk (DORA Art. 28§5 / Art. 29)
   *
   * Reuses the existing RiskService concentration calculation and enriches
   * each row with:
   *  - headquartersCountry — from ict_providers
   *  - criticalFunctionCount — number of Critical/Important business functions
   *    that depend on contracts with this provider (via function_ict_dependencies)
   */
  private async fetchRT0901(tenantId: string) {
    // 1. Get base concentration data from the existing risk engine
    const { riskItems } = await this.riskService.getConcentrationRisk(tenantId);
    if (!riskItems.length) return [];

    const providerIds = riskItems.map(r => r.providerId);

    // 2. Enrich with headquartersCountry
    const providers = await this.prisma.ictProvider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, headquartersCountry: true },
    });
    const providerMeta = new Map(providers.map(p => [p.id, p]));

    // 3. Count critical/important function dependencies per provider
    //    Path: business_functions (critical) → function_ict_dependencies → contractual_arrangements → provider
    const criticalFunctions = await this.prisma.businessFunction.findMany({
      where: {
        tenantId,
        criticalityLevel: { levelName: { in: ['Critical', 'Important'] } },
      },
      include: {
        ictDependencies: {
          include: {
            contractualArrangement: { select: { providerId: true } },
          },
        },
      },
    });

    const criticalCountMap = new Map<string, number>();
    for (const fn of criticalFunctions) {
      for (const dep of fn.ictDependencies) {
        const pid = dep.contractualArrangement?.providerId;
        if (pid) criticalCountMap.set(pid, (criticalCountMap.get(pid) ?? 0) + 1);
      }
    }

    // 4. Merge and return
    return riskItems.map(item => ({
      ...item,
      headquartersCountry: providerMeta.get(item.providerId)?.headquartersCountry ?? '',
      criticalFunctionCount: criticalCountMap.get(item.providerId) ?? 0,
    }));
  }
}

// =============================================================================
// TEMPLATE DEFINITIONS — EBA column code → DB field extractor
// =============================================================================

interface ColumnDef {
  code: string;
  name: string;
  extract: (row: any) => any;
}

interface TemplateDef {
  columns: ColumnDef[];
}

function fmtDate(d: any): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().split('T')[0];
}

function yesNo(v: any): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '';
}

const TEMPLATE_DEFS: Record<string, TemplateDef> = {
  // ---- RT.01.01: Entity maintaining register ----
  'RT.01.01': {
    columns: [
      { code: 'RT.01.01.0010', name: 'LEI of the entity', extract: r => r.lei },
      { code: 'RT.01.01.0020', name: 'Name of the entity', extract: r => r.name },
      { code: 'RT.01.01.0030', name: 'Country of the entity', extract: r => r.country },
      { code: 'RT.01.01.0040', name: 'Type of entity', extract: r => r.entityType?.name || '' },
      { code: 'RT.01.01.0050', name: 'Competent Authority', extract: r => r._tenant?.competentAuthority || '' },
      { code: 'RT.01.01.0060', name: 'Date of the reporting', extract: () => fmtDate(new Date()) },
    ],
  },

  // ---- RT.01.02: Financial entities in scope ----
  'RT.01.02': {
    columns: [
      { code: 'RT.01.02.0010', name: 'LEI of the entity', extract: r => r.lei },
      { code: 'RT.01.02.0020', name: 'Name of the entity', extract: r => r.name },
      { code: 'RT.01.02.0030', name: 'Country of the entity', extract: r => r.country },
      { code: 'RT.01.02.0040', name: 'Type of entity', extract: r => r.entityType?.name || '' },
      { code: 'RT.01.02.0050', name: 'Hierarchy of the entity', extract: r => r.parentEntityId ? 'Subsidiary' : 'Ultimate parent' },
      { code: 'RT.01.02.0060', name: 'LEI of direct parent', extract: r => r.parentEntity?.lei || r.lei },
      { code: 'RT.01.02.0070', name: 'Date of last update', extract: r => fmtDate(r.createdAt) },
      { code: 'RT.01.02.0080', name: 'Date of integration', extract: r => fmtDate(r.integrationDate) },
      { code: 'RT.01.02.0090', name: 'Date of deletion', extract: r => fmtDate(r.deletionDate) },
      { code: 'RT.01.02.0100', name: 'Currency', extract: r => r.currency || '' },
      { code: 'RT.01.02.0110', name: 'Total assets', extract: r => r.totalAssets ?? '' },
    ],
  },

  // ---- RT.01.03: Branches ----
  'RT.01.03': {
    columns: [
      { code: 'RT.01.03.0010', name: 'Branch code', extract: r => r.branchCode || r.id?.slice(0, 8) },
      { code: 'RT.01.03.0020', name: 'LEI of head office', extract: r => r.financialEntity?.lei || '' },
      { code: 'RT.01.03.0030', name: 'Name of the branch', extract: r => r.name },
      { code: 'RT.01.03.0040', name: 'Country of the branch', extract: r => r.country || '' },
    ],
  },

  // ---- RT.02.01: Contracts general ----
  'RT.02.01': {
    columns: [
      { code: 'RT.02.01.0010', name: 'Contract reference number', extract: r => r.contractReference },
      { code: 'RT.02.01.0020', name: 'Type of contractual arrangement', extract: r => r.contractType || '' },
      { code: 'RT.02.01.0030', name: 'Overarching contract ref', extract: () => '' },
      { code: 'RT.02.01.0040', name: 'Currency', extract: r => r.financialEntity?.currency || '' },
      { code: 'RT.02.01.0050', name: 'Annual expense', extract: () => '' },
    ],
  },

  // ---- RT.02.02: Contracts specific ----
  'RT.02.02': {
    columns: [
      { code: 'RT.02.02.0010', name: 'Contract reference', extract: r => r.contractReference },
      { code: 'RT.02.02.0020', name: 'LEI of entity using ICT', extract: r => r.financialEntity?.lei || '' },
      { code: 'RT.02.02.0030', name: 'Provider identification code', extract: r => r.provider?.lei || r.provider?.providerCode || '' },
      { code: 'RT.02.02.0040', name: 'Type of provider code', extract: r => r.provider?.lei ? 'LEI' : 'Other' },
      { code: 'RT.02.02.0050', name: 'Function identifier', extract: () => '' },
      { code: 'RT.02.02.0060', name: 'Type of ICT services', extract: r => r.ictServiceType?.name || '' },
      { code: 'RT.02.02.0070', name: 'Start date', extract: r => fmtDate(r.startDate) },
      { code: 'RT.02.02.0080', name: 'End date', extract: r => fmtDate(r.endDate) },
      { code: 'RT.02.02.0090', name: 'Termination reason', extract: () => '' },
      { code: 'RT.02.02.0100', name: 'Notice period (entity)', extract: r => r.terminationNoticePeriod ?? '' },
      { code: 'RT.02.02.0110', name: 'Notice period (provider)', extract: () => '' },
      { code: 'RT.02.02.0120', name: 'Governing law country', extract: r => r.governingLawCountry || '' },
      { code: 'RT.02.02.0130', name: 'Service country', extract: r => r.serviceCountry || '' },
      { code: 'RT.02.02.0140', name: 'Storage of data', extract: r => yesNo(r.dataStorage) },
      { code: 'RT.02.02.0150', name: 'Storage location', extract: r => r.storageLocation || '' },
      { code: 'RT.02.02.0160', name: 'Processing location', extract: r => r.processingLocation || '' },
      { code: 'RT.02.02.0170', name: 'Data sensitivity', extract: r => r.dataSensitivity?.levelName || '' },
      { code: 'RT.02.02.0180', name: 'Reliance level', extract: r => r.relianceLevel?.levelName || '' },
    ],
  },

  // ---- RT.03.01: Group-level contract coverage — DORA Art. 29 ----
  // One row per (entity or branch) × contract signing relationship
  'RT.03.01': {
    columns: [
      { code: 'RT.03.01.0010', name: 'Contract reference number', extract: r => r.contractReference },
      { code: 'RT.03.01.0020', name: 'LEI of financial entity', extract: r => r.entityLei },
      { code: 'RT.03.01.0030', name: 'Name of financial entity', extract: r => r.entityName },
      { code: 'RT.03.01.0040', name: 'Provider identification code', extract: r => r.providerCode },
      { code: 'RT.03.01.0050', name: 'Type of provider code', extract: r => r.providerCodeType },
      { code: 'RT.03.01.0060', name: 'Type of ICT services', extract: r => r.ictServiceType },
    ],
  },

  // ---- RT.04.01: Entities using services — DORA Art. 29 ----
  // One row per entity/branch that uses a service under a contract
  'RT.04.01': {
    columns: [
      { code: 'RT.04.01.0010', name: 'LEI of financial entity', extract: r => r.financialEntity?.lei || '' },
      { code: 'RT.04.01.0020', name: 'Name of financial entity', extract: r => r.financialEntity?.name || '' },
      { code: 'RT.04.01.0030', name: 'Branch code', extract: r => r.branch?.branchCode || (r.isBranch ? r.branchId?.slice(0, 8) : '') },
      { code: 'RT.04.01.0040', name: 'Is branch', extract: r => yesNo(r.isBranch) },
      { code: 'RT.04.01.0050', name: 'Contract reference number', extract: r => r.contract?.contractReference || '' },
      { code: 'RT.04.01.0060', name: 'Type of ICT services', extract: r => r.contract?.ictServiceType?.name || '' },
      { code: 'RT.04.01.0070', name: 'Provider identification code', extract: r => r.contract?.provider?.lei || r.contract?.provider?.providerCode || '' },
    ],
  },

  // ---- RT.05.01: ICT providers ----
  'RT.05.01': {
    columns: [
      { code: 'RT.05.01.0010', name: 'Provider identification code', extract: r => r.lei || r.providerCode },
      { code: 'RT.05.01.0020', name: 'Type of code', extract: r => r.lei ? 'LEI' : 'Other' },
      { code: 'RT.05.01.0030', name: 'Name of provider', extract: r => r.legalName || '' },
      { code: 'RT.05.01.0040', name: 'Type of person', extract: r => r.personType?.name || '' },
      { code: 'RT.05.01.0050', name: 'Headquarters country', extract: r => r.headquartersCountry || '' },
      { code: 'RT.05.01.0060', name: 'Currency', extract: r => r.currency || '' },
      { code: 'RT.05.01.0070', name: 'Total annual expense', extract: r => r.annualCost ?? '' },
      { code: 'RT.05.01.0080', name: 'Ultimate parent code', extract: r => r.ultimateParentLei || '' },
      { code: 'RT.05.01.0090', name: 'Ultimate parent code type', extract: r => r.ultimateParentLei ? 'LEI' : '' },
    ],
  },

  // ---- RT.05.02: Supply chain ----
  'RT.05.02': {
    columns: [
      { code: 'RT.05.02.0010', name: 'Contract reference', extract: r => r.contractualArrangement?.contractReference || '' },
      { code: 'RT.05.02.0020', name: 'Type of ICT services', extract: r => r.serviceType?.name || '' },
      { code: 'RT.05.02.0030', name: 'Provider code', extract: r => r.parentLink?.provider?.lei || r.parentLink?.provider?.providerCode || r.contractualArrangement?.provider?.lei || '' },
      { code: 'RT.05.02.0040', name: 'Type of provider code', extract: r => r.parentLink?.provider?.lei ? 'LEI' : 'Other' },
      { code: 'RT.05.02.0050', name: 'Rank', extract: r => r.supplyRank ?? '' },
      { code: 'RT.05.02.0060', name: 'Subcontractor code', extract: r => r.provider?.lei || r.provider?.providerCode || '' },
      { code: 'RT.05.02.0070', name: 'Subcontractor code type', extract: r => r.provider?.lei ? 'LEI' : (r.provider ? 'Other' : '') },
    ],
  },

  // ---- RT.06.01: Functions ----
  'RT.06.01': {
    columns: [
      { code: 'RT.06.01.0010', name: 'Function Identifier', extract: r => r.functionIdentifier },
      { code: 'RT.06.01.0020', name: 'Licensed activity', extract: r => r.licensedActivity || '' },
      { code: 'RT.06.01.0030', name: 'Function name', extract: r => r.functionName },
      { code: 'RT.06.01.0040', name: 'LEI of financial entity', extract: r => r.financialEntity?.lei || '' },
      { code: 'RT.06.01.0060', name: 'Criticality assessment', extract: r => r.criticalityLevel?.levelName || '' },
      { code: 'RT.06.01.0070', name: 'Reasons for criticality', extract: r => r.criticalityReason || '' },
      { code: 'RT.06.01.0080', name: 'Last assessment date', extract: r => fmtDate(r.lastAssessmentDate) },
      { code: 'RT.06.01.0090', name: 'RTO', extract: r => r.rto ?? '' },
      { code: 'RT.06.01.0100', name: 'RPO', extract: r => r.rpo ?? '' },
      { code: 'RT.06.01.0110', name: 'Impact of discontinuing', extract: r => r.impactDiscontinuation || '' },
    ],
  },

  // ---- RT.07.01: Assessments ----
  'RT.07.01': {
    columns: [
      { code: 'RT.07.01.0010', name: 'Contract reference', extract: r => r.contract?.contractReference || '' },
      { code: 'RT.07.01.0020', name: 'Provider code', extract: r => r.provider?.lei || r.provider?.providerCode || '' },
      { code: 'RT.07.01.0030', name: 'Provider code type', extract: r => r.provider?.lei ? 'LEI' : 'Other' },
      { code: 'RT.07.01.0040', name: 'Type of ICT services', extract: r => r.contract?.ictServiceType?.name || '' },
      { code: 'RT.07.01.0050', name: 'Substitutability', extract: r => r.isSubstitutable === true ? 'Easily substitutable' : r.isSubstitutable === false ? 'Not substitutable' : '' },
      { code: 'RT.07.01.0060', name: 'Reason not substitutable', extract: r => r.substitutionReason || '' },
      { code: 'RT.07.01.0070', name: 'Last audit date', extract: r => fmtDate(r.lastAuditDate) },
      { code: 'RT.07.01.0080', name: 'Exit plan exists', extract: r => yesNo(r.exitPlanExists) },
      { code: 'RT.07.01.0090', name: 'Reintegration possible', extract: r => yesNo(r.reintegrationPossible) },
      { code: 'RT.07.01.0100', name: 'Impact of discontinuation', extract: r => r.discontinuationImpact || '' },
      { code: 'RT.07.01.0110', name: 'Alternative providers', extract: r => yesNo(r.alternativeProvidersExist) },
      { code: 'RT.07.01.0120', name: 'Alternative provider ref', extract: r => r.alternativeProviderReference || '' },
    ],
  },

  // ---- RT.08.01: Exit Strategies (DORA Art. 28§8) ----
  // One row per documented exit strategy
  'RT.08.01': {
    columns: [
      { code: 'RT.08.01.0010', name: 'Contract reference number', extract: r => r.contract?.contractReference || '' },
      { code: 'RT.08.01.0020', name: 'LEI of financial entity', extract: r => r.contract?.financialEntity?.lei || '' },
      { code: 'RT.08.01.0030', name: 'Provider identification code', extract: r => r.contract?.provider?.lei || r.contract?.provider?.providerCode || '' },
      { code: 'RT.08.01.0040', name: 'Type of provider code', extract: r => r.contract?.provider?.lei ? 'LEI' : 'Other' },
      { code: 'RT.08.01.0050', name: 'Type of ICT services', extract: r => r.contract?.ictServiceType?.name || '' },
      { code: 'RT.08.01.0060', name: 'Exit trigger conditions', extract: r => r.exitTrigger || '' },
      { code: 'RT.08.01.0070', name: 'Exit strategy description', extract: r => r.exitStrategy || '' },
      { code: 'RT.08.01.0080', name: 'Fallback provider code', extract: r => r.fallbackProvider?.lei || r.fallbackProvider?.providerCode || '' },
      { code: 'RT.08.01.0090', name: 'Fallback provider code type', extract: r => r.fallbackProvider?.lei ? 'LEI' : (r.fallbackProvider ? 'Other' : '') },
      { code: 'RT.08.01.0100', name: 'Exit plan linked to assessment', extract: r => r.assessmentId ? 'Yes' : 'No' },
      { code: 'RT.08.01.0110', name: 'Strategy creation date', extract: r => fmtDate(r.createdAt) },
    ],
  },

  // ---- RT.09.01: Concentration Risk (DORA Art. 28§5 / Art. 29) ----
  // One row per ICT third-party service provider showing their share of
  // contractual arrangements and derived concentration risk classification.
  'RT.09.01': {
    columns: [
      { code: 'RT.09.01.0010', name: 'Provider identification code',       extract: (r: any) => (r.providerLei || '').trim() || r.providerId },
      { code: 'RT.09.01.0020', name: 'Type of provider code',              extract: (r: any) => r.providerLei ? 'LEI' : 'Internal ID' },
      { code: 'RT.09.01.0030', name: 'Provider legal name',                extract: (r: any) => r.providerName || '' },
      { code: 'RT.09.01.0040', name: 'Number of contractual arrangements', extract: (r: any) => r.contractCount },
      { code: 'RT.09.01.0050', name: 'Percentage share of arrangements',   extract: (r: any) => r.percentageShare },
      { code: 'RT.09.01.0060', name: 'Concentration risk level',           extract: (r: any) => r.riskLevel },
      { code: 'RT.09.01.0070', name: 'Critical function dependency count', extract: (r: any) => r.criticalFunctionCount ?? '' },
      { code: 'RT.09.01.0080', name: 'Provider headquarters country',      extract: (r: any) => (r.headquartersCountry || '').trim() },
    ],
  },
};
