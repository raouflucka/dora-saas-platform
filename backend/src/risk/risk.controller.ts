import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RiskService } from './risk.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Risk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk')
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('concentration')
  @ApiOperation({
    summary: 'ICT provider concentration risk analysis (DORA Art. 28§5 / EBA RT.09)',
    description:
      'Returns providers grouped by contract share. HIGH ≥ 33%, MEDIUM ≥ 20%, LOW < 20%. ' +
      'Dominant providers (≥33%) must be addressed per DORA Art. 28§5.',
  })
  getConcentration(@Request() req) {
    return this.riskService.getConcentrationRisk(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('geographic')
  @ApiOperation({
    summary: 'Geographic concentration risk analysis (DORA Art. 29)',
    description: 'Returns concentration metrics based on country of provisioning.',
  })
  getGeographic(@Request() req) {
    return this.riskService.getGeographicRisk(req.user.tenantId);
  }
}
