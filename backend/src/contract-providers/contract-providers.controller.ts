import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ContractProvidersService } from './contract-providers.service';
import { CreateContractProviderDto } from './dto/create-contract-provider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Contract Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contract-providers')
export class ContractProvidersController {
  constructor(private readonly service: ContractProvidersService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  @ApiOperation({
    summary: 'Link an additional ICT provider (subcontractor/co-signatory) to a contract (EBA RT.02)',
    description: 'Captures all ICT providers with a contractual link, not just the primary provider. Required for complete RT.02 Annex III reporting.',
  })
  create(@Request() req, @Body() dto: CreateContractProviderDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'List all additional providers linked to a contract' })
  @ApiQuery({ name: 'contractId', required: true })
  findByContract(@Request() req, @Query('contractId') contractId: string) {
    return this.service.findByContract(contractId, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove an additional provider link from a contract' })
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }
}
