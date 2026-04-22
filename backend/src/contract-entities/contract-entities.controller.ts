import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContractEntitiesService } from './contract-entities.service';
import { CreateContractEntityDto } from './dto/create-contract-entity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Contract Entities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contract-entities')
export class ContractEntitiesController {
  constructor(private readonly service: ContractEntitiesService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  @ApiOperation({
    summary: 'Link a financial entity to a contractual arrangement (EBA RT.03)',
    description: 'Records which financial entities are party to a given contract. Required for RT.03 sub-template reporting.',
  })
  create(@Request() req, @Body() dto: CreateContractEntityDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'List all entities linked to a contract' })
  @ApiQuery({ name: 'contractId', required: true, description: 'UUID of the contractual arrangement' })
  findByContract(@Request() req, @Query('contractId') contractId: string) {
    return this.service.findByContract(contractId, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove a financial entity link from a contract' })
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }
}
