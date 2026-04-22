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
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IctServicesService } from './ict-services.service';
import { CreateIctServiceDto } from './dto/create-ict-service.dto';
import { UpdateIctServiceDto } from './dto/update-ict-service.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('ICT Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ict-services')
export class IctServicesController {
  constructor(private readonly ictServicesService: IctServicesService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  @ApiOperation({ summary: 'Create an ICT service for a provider' })
  create(@Request() req, @Body() dto: CreateIctServiceDto) {
    return this.ictServicesService.create(req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  @ApiOperation({ summary: 'List all ICT services for the tenant' })
  @ApiQuery({ name: 'providerId', required: false, description: 'Filter by ICT Provider ID' })
  findAll(@Request() req, @Query('providerId') providerId?: string) {
    return this.ictServicesService.findAll(req.user.tenantId, providerId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single ICT service by ID' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.ictServicesService.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an ICT service' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateIctServiceDto) {
    return this.ictServicesService.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN', 'EDITOR')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an ICT service' })
  remove(@Request() req, @Param('id') id: string) {
    return this.ictServicesService.remove(id, req.user.tenantId);
  }
}
