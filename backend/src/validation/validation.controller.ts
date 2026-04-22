import { Controller, Post, Get, Param, Patch, Body, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ValidationService } from './validation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Validation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('validation')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('rules')
  @ApiOperation({ summary: 'List all active validation rules' })
  getRules(@Request() req) {
    return this.validationService.loadRules();
  }

  @Roles('ADMIN', 'ANALYST')
  @Post('run')
  @ApiOperation({
    summary: 'Run all active validation rules against this tenant\'s data',
    description:
      'Executes required, fk_exists, format, range, dropdown, cross-field, and conditional rules. Results are persisted to validation_runs.',
  })
  async run(@Request() req) {
    return this.validationService.runValidation(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('runs')
  @ApiOperation({ summary: 'List validation run history (without results)' })
  getHistory(@Request() req) {
    return this.validationService.getRunHistory(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a specific validation run with full results' })
  async getRunById(@Param('id') id: string, @Request() req) {
    const run = await this.validationService.getRunById(id, req.user.tenantId);
    if (!run) throw new NotFoundException(`Validation run ${id} not found`);
    return run;
  }

  @Roles('ADMIN', 'ANALYST')
  @Patch('runs/:id/flag')
  @ApiOperation({ summary: 'Flag or unflag a validation issue, optionally adding an analyst comment' })
  @ApiBody({ schema: { type: 'object', properties: { ruleId: { type: 'string' }, recordId: { type: 'string' }, comment: { type: 'string', description: 'Optional analyst instruction for the Editor' } } } })
  async flagIssue(
    @Param('id') id: string,
    @Body('ruleId') ruleId: string,
    @Body('recordId') recordId: string,
    @Body('comment') comment: string | undefined,
    @Request() req,
  ) {
    return this.validationService.flagIssue(req.user.tenantId, id, ruleId, recordId, comment, req.user.sub);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Patch('runs/:id/resolve')
  @ApiOperation({ summary: 'Editor or Analyst submits fix — moves issue to WAITING_APPROVAL' })
  @ApiBody({ schema: { type: 'object', properties: { ruleId: { type: 'string' }, recordId: { type: 'string' }, note: { type: 'string' } } } })
  async resolveIssue(
    @Param('id') id: string,
    @Body('ruleId') ruleId: string,
    @Body('recordId') recordId: string,
    @Body('note') note: string | undefined,
    @Request() req,
  ) {
    return this.validationService.resolveIssue(req.user.tenantId, id, ruleId, recordId, note, req.user.sub);
  }

  @Roles('ADMIN', 'ANALYST')
  @Patch('runs/:id/approve')
  @ApiOperation({ summary: 'Analyst approves an Editor fix — marks issue RESOLVED' })
  @ApiBody({ schema: { type: 'object', properties: { ruleId: { type: 'string' }, recordId: { type: 'string' } } } })
  async approveIssue(
    @Param('id') id: string,
    @Body('ruleId') ruleId: string,
    @Body('recordId') recordId: string,
    @Request() req,
  ) {
    return this.validationService.approveIssue(req.user.tenantId, id, ruleId, recordId, req.user.sub);
  }

  @Roles('ADMIN', 'ANALYST')
  @Patch('runs/:id/reject')
  @ApiOperation({ summary: 'Analyst rejects an Editor fix — resets issue to FLAGGED' })
  @ApiBody({ schema: { type: 'object', properties: { ruleId: { type: 'string' }, recordId: { type: 'string' }, reason: { type: 'string' } } } })
  async rejectIssue(
    @Param('id') id: string,
    @Body('ruleId') ruleId: string,
    @Body('recordId') recordId: string,
    @Body('reason') reason: string | undefined,
    @Request() req,
  ) {
    return this.validationService.rejectIssue(req.user.tenantId, id, ruleId, recordId, reason, req.user.sub);
  }
}
