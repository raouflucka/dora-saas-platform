import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Request, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExitStrategiesService } from './exit-strategies.service';
import { CreateExitStrategyDto } from './dto/create-exit-strategy.dto';
import { UpdateExitStrategyDto } from './dto/update-exit-strategy.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Exit Strategies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exit-strategies')
export class ExitStrategiesController {
  constructor(private readonly service: ExitStrategiesService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  @ApiOperation({ summary: 'Create an exit strategy for a contract (DORA Art. 28§5)' })
  create(@Request() req, @Body() dto: CreateExitStrategyDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'List all exit strategies for the tenant' })
  @ApiQuery({ name: 'contractId', required: false })
  findAll(@Request() req, @Query('contractId') contractId?: string) {
    return this.service.findAll(req.user.tenantId, contractId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single exit strategy' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an exit strategy' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateExitStrategyDto) {
    return this.service.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an exit strategy' })
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }
}
