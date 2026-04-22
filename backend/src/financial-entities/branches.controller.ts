import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { FinancialEntitiesService } from './financial-entities.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-entities/:entityId/branches')
export class BranchesController {
  constructor(private readonly financialEntitiesService: FinancialEntitiesService) {}

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  getBranches(@Request() req, @Param('entityId') entityId: string) {
    return this.financialEntitiesService.getBranches(req.user.tenantId, entityId);
  }

  @Roles('ADMIN')
  @Post()
  addBranch(@Request() req, @Param('entityId') entityId: string, @Body() createBranchDto: CreateBranchDto) {
    return this.financialEntitiesService.addBranch(req.user.tenantId, entityId, createBranchDto);
  }
}
