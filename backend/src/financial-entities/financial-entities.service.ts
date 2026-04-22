import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialEntityDto } from './dto/create-financial-entity.dto';
import { UpdateFinancialEntityDto } from './dto/update-financial-entity.dto';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class FinancialEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateFinancialEntityDto) {
    if (data.parentEntityId) {
      // Verify parent belongs to the same tenant
      const parent = await this.prisma.financialEntity.findFirst({
        where: { id: data.parentEntityId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException('Parent entity not found or does not belong to your tenant.');
      }
    }

    return this.prisma.financialEntity.create({
      data: {
        ...data,
        tenantId,
        integrationDate: data.integrationDate ? new Date(data.integrationDate) : undefined,
        deletionDate: data.deletionDate ? new Date(data.deletionDate) : undefined,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.financialEntity.findMany({
      where: { tenantId },
      include: {
        entityType: true,
        countryRef: true,
        currencyRef: true,
        parentEntity: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const entity = await this.prisma.financialEntity.findFirst({
      where: { id, tenantId },
      include: {
        entityType: true,
        countryRef: true,
        currencyRef: true,
        childEntities: true,
        branches: true,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Financial Entity with id ${id} not found.`);
    }

    return entity;
  }

  async update(id: string, tenantId: string, data: UpdateFinancialEntityDto) {
    // Ensure it exists and belongs to the tenant
    await this.findOne(id, tenantId);

    if (data.parentEntityId) {
      const parent = await this.prisma.financialEntity.findFirst({
        where: { id: data.parentEntityId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException('Parent entity not found or does not belong to your tenant.');
      }
    }

    return this.prisma.financialEntity.update({
      where: { id },
      data: {
        ...data,
        integrationDate: data.integrationDate ? new Date(data.integrationDate) : undefined,
        deletionDate: data.deletionDate ? new Date(data.deletionDate) : undefined,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // First verify it exists and belongs to tenant
    await this.findOne(id, tenantId);

    // Prisma will throw if there are foreign key constraints (like entities using services, branches, etc)
    // We can either catch it and throw a friendly error, or let the global filter handle it.
    
    
    return this.prisma.financialEntity.delete({
      where: { id },
    });
  }

  // ---- Branches Logic ----

  async getBranches(tenantId: string, financialEntityId: string) {
    // Verify parent entity ownership first
    await this.findOne(financialEntityId, tenantId);

    return this.prisma.branch.findMany({
      where: { financialEntityId, tenantId },
      include: {
        countryRef: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async addBranch(tenantId: string, financialEntityId: string, data: CreateBranchDto) {
    // Verify parent entity ownership first
    await this.findOne(financialEntityId, tenantId);

    return this.prisma.branch.create({
      data: {
        ...data,
        tenantId,
        financialEntityId,
      },
    });
  }
}
