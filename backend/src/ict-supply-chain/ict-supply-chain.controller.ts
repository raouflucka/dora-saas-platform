import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IctSupplyChainService } from './ict-supply-chain.service';
import { CreateSupplyChainDto } from './dto/create-supply-chain.dto';
import { UpdateSupplyChainDto } from './dto/update-supply-chain.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('ICT Supply Chain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ict-supply-chain')
export class IctSupplyChainController {
  constructor(private readonly service: IctSupplyChainService) {}

  @Roles('ADMIN', 'ANALYST')
  @Post()
  @ApiOperation({ summary: 'Add a supply chain entry (link provider → subcontractor)' })
  create(@Request() req, @Body() dto: CreateSupplyChainDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'List all supply chain entries for this tenant' })
  @ApiQuery({ name: 'contractId', required: false })
  findAll(@Request() req, @Query('contractId') contractId?: string) {
    return this.service.findAll(req.user.tenantId, contractId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('chain/:contractId')
  @ApiOperation({ summary: 'Get full hierarchical chain for a contract (grouped by supply_rank)' })
  getChain(@Request() req, @Param('contractId') contractId: string) {
    return this.service.findChainForContract(contractId, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get('tree/:contractId')
  @ApiOperation({ summary: 'Get full recursive tree chain for a contract UI graph' })
  getTree(@Request() req, @Param('contractId') contractId: string) {
    return this.service.getTreeForContract(contractId, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single supply chain entry' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a supply chain entry' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateSupplyChainDto) {
    return this.service.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST')
  @Delete(':id')
  @ApiOperation({ summary: 'Remove a supply chain entry' })
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }
}
