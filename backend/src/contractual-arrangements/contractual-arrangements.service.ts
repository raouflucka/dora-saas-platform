import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractualArrangementDto } from './dto/create-contractual-arrangement.dto';
import { UpdateContractualArrangementDto } from './dto/update-contractual-arrangement.dto';

@Injectable()
export class ContractualArrangementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateContractualArrangementDto) {
    // Basic verification: user must own the financial entity and provider
    const fe = await this.prisma.financialEntity.findFirst({
      where: { id: data.financialEntityId, tenantId },
    });
    if (!fe) throw new NotFoundException('Financial Entity not found or access denied');

    const provider = await this.prisma.ictProvider.findFirst({
      where: { id: data.providerId, tenantId },
    });
    if (!provider) throw new NotFoundException('ICT Provider not found or access denied');

    return this.prisma.contractualArrangement.create({
      data: {
        ...data,
        tenantId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.contractualArrangement.findMany({
      where: { tenantId },
      include: {
        financialEntity: true,
        provider: true,
        subcontractorProvider: true,
        ictServiceType: true,
        relianceLevel: true,
        dataSensitivity: true,
        governingLawRef: true,
        serviceCountryRef: true,
        processingRef: true,
        storageRef: true,
        ictDependencies: {
          include: { businessFunction: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const record = await this.prisma.contractualArrangement.findFirst({
      where: { id, tenantId },
      include: {
        financialEntity: true,
        provider: true,
        subcontractorProvider: true,
        ictServiceType: true,
        relianceLevel: true,
        dataSensitivity: true,
        governingLawRef: true,
        serviceCountryRef: true,
        processingRef: true,
        storageRef: true,
        ictDependencies: {
          include: { businessFunction: true }
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Contractual Arrangement with id ${id} not found.`);
    }

    return record;
  }

  async update(id: string, tenantId: string, data: UpdateContractualArrangementDto) {
    await this.findOne(id, tenantId);

    // Optional ownership verification for updated relations could be added here
    if (data.financialEntityId) {
       const fe = await this.prisma.financialEntity.findFirst({ where: { id: data.financialEntityId, tenantId } });
       if (!fe) throw new NotFoundException('Financial Entity not found');
    }
    if (data.providerId) {
       const prov = await this.prisma.ictProvider.findFirst({ where: { id: data.providerId, tenantId } });
       if (!prov) throw new NotFoundException('Provider not found');
    }

    return this.prisma.contractualArrangement.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.contractualArrangement.delete({
      where: { id },
    });
  }
}
