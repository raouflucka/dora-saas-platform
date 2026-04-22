import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIctServiceDto } from './dto/create-ict-service.dto';
import { UpdateIctServiceDto } from './dto/update-ict-service.dto';

@Injectable()
export class IctServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateIctServiceDto) {
    const provider = await this.prisma.ictProvider.findFirst({
      where: { id: data.providerId, tenantId },
    });
    if (!provider) {
      throw new NotFoundException('ICT Provider not found or access denied.');
    }

    return this.prisma.ictService.create({
      data: {
        tenantId,
        providerId: data.providerId,
        serviceName: data.serviceName,
        serviceDescription: data.serviceDescription,
        serviceTypeId: data.serviceTypeId,
        criticalityLevelId: data.criticalityLevelId,
        dataSensitivityId: data.dataSensitivityId,
      },
      include: {
        provider: { select: { id: true, providerCode: true, legalName: true } },
        serviceType: { select: { id: true, name: true } },
        criticalityLevel: { select: { id: true, levelName: true } },
        dataSensitivity: { select: { id: true, levelName: true } },
      },
    });
  }

  async findAll(tenantId: string, providerId?: string) {
    return this.prisma.ictService.findMany({
      where: {
        tenantId,
        ...(providerId ? { providerId } : {}),
      },
      include: {
        provider: { select: { id: true, providerCode: true, legalName: true } },
        serviceType: { select: { id: true, name: true } },
        criticalityLevel: { select: { id: true, levelName: true } },
        dataSensitivity: { select: { id: true, levelName: true } },
      },
      orderBy: { serviceName: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const service = await this.prisma.ictService.findFirst({
      where: { id, tenantId },
      include: {
        provider: { select: { id: true, providerCode: true, legalName: true } },
        serviceType: { select: { id: true, name: true } },
        criticalityLevel: { select: { id: true, levelName: true } },
        dataSensitivity: { select: { id: true, levelName: true } },
      },
    });

    if (!service) {
      throw new NotFoundException(`ICT Service with id ${id} not found.`);
    }

    return service;
  }

  async update(id: string, tenantId: string, data: UpdateIctServiceDto) {
    await this.findOne(id, tenantId);

    return this.prisma.ictService.update({
      where: { id },
      data: {
        ...(data.serviceName !== undefined && { serviceName: data.serviceName }),
        ...(data.serviceDescription !== undefined && { serviceDescription: data.serviceDescription }),
        ...(data.serviceTypeId !== undefined && { serviceTypeId: data.serviceTypeId }),
        ...(data.criticalityLevelId !== undefined && { criticalityLevelId: data.criticalityLevelId }),
        ...(data.dataSensitivityId !== undefined && { dataSensitivityId: data.dataSensitivityId }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.ictService.delete({ where: { id } });
    return { message: `ICT Service ${id} deleted.` };
  }
}
