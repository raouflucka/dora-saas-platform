import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { FinancialEntitiesService } from './financial-entities.service';
import { CreateFinancialEntityDto } from './dto/create-financial-entity.dto';
import { UpdateFinancialEntityDto } from './dto/update-financial-entity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-entities')
export class FinancialEntitiesController {
  constructor(private readonly financialEntitiesService: FinancialEntitiesService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  create(@Request() req, @Body() createFinancialEntityDto: CreateFinancialEntityDto) {
    return this.financialEntitiesService.create(req.user.tenantId, createFinancialEntityDto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  findAll(@Request() req) {
    return this.financialEntitiesService.findAll(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.financialEntitiesService.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateFinancialEntityDto: UpdateFinancialEntityDto) {
    return this.financialEntitiesService.update(id, req.user.tenantId, updateFinancialEntityDto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.financialEntitiesService.remove(id, req.user.tenantId);
  }
}
