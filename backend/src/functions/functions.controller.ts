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
import { BusinessFunctionsService } from './functions.service';
import { CreateBusinessFunctionDto } from './dto/create-business-function.dto';
import { UpdateBusinessFunctionDto } from './dto/update-business-function.dto';
import { AddIctDependencyDto } from './dto/add-ict-dependency.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Business Functions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('business-functions')
export class BusinessFunctionsController {
  constructor(private readonly service: BusinessFunctionsService) {}

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Post()
  @ApiOperation({ summary: 'Create business function' })
  create(@Request() req, @Body() dto: CreateBusinessFunctionDto) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'Get all business functions' })
  findAll(@Request() req) {
    return this.service.findAll(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  @ApiOperation({ summary: 'Get business function by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Patch(':id')
  @ApiOperation({ summary: 'Update business function' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateBusinessFunctionDto) {
    return this.service.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete business function' })
  remove(@Request() req, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST')
  @Post(':id/dependencies')
  @ApiOperation({ summary: 'Add ICT dependency' })
  addDependency(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddIctDependencyDto,
  ) {
    return this.service.addIctDependency(id, req.user.tenantId, dto.contractId);
  }

  @Roles('ADMIN', 'ANALYST')
  @Delete(':id/dependencies/:contractId')
  @ApiOperation({ summary: 'Remove ICT dependency' })
  removeDependency(
    @Request() req,
    @Param('id') id: string,
    @Param('contractId') contractId: string,
  ) {
    return this.service.removeIctDependency(id, req.user.tenantId, contractId);
  }
}
