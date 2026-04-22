import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RiskAssessmentService } from './risk-assessment.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk-assessment')
export class RiskAssessmentController {
  constructor(private readonly service: RiskAssessmentService) {}

  // Analyst is the operational owner of risk assessments (DORA Art. 28§5)
  // Admin retains create/update for admin-level management
  @Roles('ADMIN', 'ANALYST')
  @Post()
  create(@Request() req, @Body() dto: CreateAssessmentDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST')
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateAssessmentDto) {
    return this.service.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }
}
