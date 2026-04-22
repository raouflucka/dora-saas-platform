import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { IctProvidersService } from './ict-providers.service';
import { CreateIctProviderDto } from './dto/create-ict-provider.dto';
import { UpdateIctProviderDto } from './dto/update-ict-provider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ict-providers')
export class IctProvidersController {
  constructor(private readonly ictProvidersService: IctProvidersService) {}

  @Roles('ADMIN', 'EDITOR')
  @Post()
  create(@Request() req, @Body() createIctProviderDto: CreateIctProviderDto) {
    return this.ictProvidersService.create(req.user.tenantId, createIctProviderDto);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get()
  findAll(@Request() req) {
    return this.ictProvidersService.findAll(req.user.tenantId);
  }

  @Roles('ADMIN', 'ANALYST', 'EDITOR')
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.ictProvidersService.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN', 'EDITOR')
  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateIctProviderDto: UpdateIctProviderDto) {
    return this.ictProvidersService.update(id, req.user.tenantId, updateIctProviderDto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.ictProvidersService.remove(id, req.user.tenantId);
  }
}
