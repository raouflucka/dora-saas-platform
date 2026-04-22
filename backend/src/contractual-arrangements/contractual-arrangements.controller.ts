import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ContractualArrangementsService } from './contractual-arrangements.service';
import { CreateContractualArrangementDto } from './dto/create-contractual-arrangement.dto';
import { UpdateContractualArrangementDto } from './dto/update-contractual-arrangement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contractual-arrangements')
export class ContractualArrangementsController {
  constructor(private readonly contractualArrangementsService: ContractualArrangementsService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  create(@Request() req, @Body() createContractualArrangementDto: CreateContractualArrangementDto) {
    return this.contractualArrangementsService.create(req.user.tenantId, createContractualArrangementDto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  findAll(@Request() req) {
    return this.contractualArrangementsService.findAll(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.contractualArrangementsService.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateContractualArrangementDto: UpdateContractualArrangementDto) {
    return this.contractualArrangementsService.update(id, req.user.tenantId, updateContractualArrangementDto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.contractualArrangementsService.remove(id, req.user.tenantId);
  }
}
