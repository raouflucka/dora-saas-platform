import { Controller, Get, Query, Res, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { RoiExportService, SUPPORTED_TEMPLATES, type TemplateName } from './roi-export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('RoI Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roi')
export class RoiExportController {
  constructor(private readonly roiExportService: RoiExportService) {}

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('templates')
  @ApiOperation({ summary: 'List available EBA RT templates for export' })
  listTemplates() {
    return {
      templates: SUPPORTED_TEMPLATES.map(t => ({ code: t })),
    };
  }

  @Roles('ADMIN', 'ANALYST')
  @Get('preflight')
  @ApiOperation({ summary: 'Run validation pre-flight check before export' })
  async preflight(@Request() req) {
    const run = await this.roiExportService.preflight(req.user.tenantId);
    return {
      exportReady: run.totalErrors === 0,
      totalErrors: run.totalErrors,
      totalWarnings: run.totalWarnings,
      runId: run.runId,
    };
  }

  @Roles('ADMIN', 'ANALYST')
  @Get('export')
  @ApiOperation({
    summary: 'Export Register of Information as Excel',
    description: 'Downloads an Excel workbook with EBA RT template sheets. Pre-flight validation runs automatically — export blocked if errors > 0.',
  })
  @ApiQuery({ name: 'template', required: false, description: 'Single template code (e.g. RT.01.01). Omit for full workbook.' })
  async exportExcel(
    @Request() req,
    @Res() res: Response,
    @Query('template') template?: string,
  ) {
    const tenantId = req.user.tenantId;

    // Pre-flight validation
    await this.roiExportService.preflight(tenantId);

    let wb;
    let filename: string;

    if (template && SUPPORTED_TEMPLATES.includes(template as TemplateName)) {
      wb = await this.roiExportService.generateSingleTemplate(tenantId, template as TemplateName);
      filename = `DORA_RoI_${template.replace(/\./g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
      wb = await this.roiExportService.generateWorkbook(tenantId);
      filename = `DORA_RoI_Full_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  }

  @Roles('ADMIN', 'ANALYST')
  @Get('export/xbrl')
  @ApiOperation({
    summary: 'Export Register of Information as XBRL OIM-CSV ZIP',
    description:
      'Downloads a ZIP archive containing one CSV per EBA RT template plus a metadata.json. ' +
      'Follows the EBA OIM-CSV structure for CBI Portal submission. ' +
      'Pre-flight validation runs automatically — export blocked if errors > 0.',
  })
  async exportXbrl(@Request() req, @Res() res: Response) {
    const tenantId = req.user.tenantId;

    // Pre-flight validation (must pass before XBRL export)
    await this.roiExportService.preflight(tenantId);

    const zipBuffer = await this.roiExportService.generateXbrlZip(tenantId);
    const filename = `DORA_RoI_XBRL_${new Date().toISOString().split('T')[0]}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.end(zipBuffer);
  }
}
