import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('reference')
@UseGuards(JwtAuthGuard)
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('countries')
  getCountries() {
    return this.referenceService.getCountries();
  }

  @Get('currencies')
  getCurrencies() {
    return this.referenceService.getCurrencies();
  }

  @Get('ict-service-types')
  getIctServiceTypes() {
    return this.referenceService.getIctServiceTypes();
  }

  @Get('reliance-levels')
  getRelianceLevels() {
    return this.referenceService.getRelianceLevels();
  }

  @Get('data-sensitivity-levels')
  getDataSensitivityLevels() {
    return this.referenceService.getDataSensitivityLevels();
  }

  @Get('criticality-levels')
  getCriticalityLevels() {
    return this.referenceService.getCriticalityLevels();
  }

  @Get('entity-types')
  getEntityTypes() {
    return this.referenceService.getEntityTypes();
  }

  @Get('provider-person-types')
  getProviderPersonTypes() {
    return this.referenceService.getProviderPersonTypes();
  }
}
