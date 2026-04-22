import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReferenceService {
  constructor(private prisma: PrismaService) {}

  async getCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCurrencies() {
    return this.prisma.currency.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async getIctServiceTypes() {
    return this.prisma.ictServiceType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getRelianceLevels() {
    return this.prisma.relianceLevel.findMany({
      orderBy: { levelName: 'asc' },
    });
  }

  async getDataSensitivityLevels() {
    return this.prisma.dataSensitivityLevel.findMany({
      orderBy: { levelName: 'asc' },
    });
  }

  async getCriticalityLevels() {
    return this.prisma.criticalityLevel.findMany({
      orderBy: { levelName: 'asc' },
    });
  }

  async getEntityTypes() {
    return this.prisma.entityType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getProviderPersonTypes() {
    return this.prisma.providerPersonType.findMany({
      orderBy: { id: 'asc' },
    });
  }
}
