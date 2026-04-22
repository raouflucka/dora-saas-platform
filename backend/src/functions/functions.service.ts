import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessFunctionDto } from './dto/create-business-function.dto';
import { UpdateBusinessFunctionDto } from './dto/update-business-function.dto';

@Injectable()
export class BusinessFunctionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateBusinessFunctionDto) {
    // Verify financialEntity belongs to the tenant
    const entity = await this.prisma.financialEntity.findFirst({
      where: { id: data.financialEntityId, tenantId },
    });
    if (!entity) {
      throw new NotFoundException('Financial Entity not found or access denied');
    }

    return this.prisma.businessFunction.create({
      data: {
        ...data,
        tenantId,
        lastAssessmentDate: data.lastAssessmentDate
          ? new Date(data.lastAssessmentDate)
          : undefined,
      },
      include: {
        financialEntity: true,
        criticalityLevel: true,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.businessFunction.findMany({
      where: { tenantId },
      include: {
        financialEntity: true,
        criticalityLevel: true,
      },
      orderBy: { functionIdentifier: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const record = await this.prisma.businessFunction.findFirst({
      where: { id, tenantId },
      include: {
        financialEntity: true,
        criticalityLevel: true,
        ictDependencies: {
          include: {
            contractualArrangement: {
              include: { provider: true, ictServiceType: true },
            },
          },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Business Function with id ${id} not found.`);
    }
    return record;
  }

  async update(id: string, tenantId: string, data: UpdateBusinessFunctionDto) {
    await this.findOne(id, tenantId);

    if (data.financialEntityId) {
      const entity = await this.prisma.financialEntity.findFirst({
        where: { id: data.financialEntityId, tenantId },
      });
      if (!entity) throw new NotFoundException('Financial Entity not found');
    }

    return this.prisma.businessFunction.update({
      where: { id },
      data: {
        ...data,
        lastAssessmentDate: data.lastAssessmentDate
          ? new Date(data.lastAssessmentDate)
          : undefined,
      },
      include: {
        financialEntity: true,
        criticalityLevel: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.businessFunction.delete({ where: { id } });
  }

  async addIctDependency(id: string, tenantId: string, contractId: string) {
    // 1. Verify business function exists and belongs to tenant
    await this.findOne(id, tenantId);

    // 2. Verify contract exists and belongs to tenant
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contractual Arrangement not found');
    }

    // 2b. DORA Art.28§3 — EBA Business Logic Guard
    // A Business Function ICT dependency can only be mapped to a contract
    // where the service involves a subcontractor. If the service is delivered
    // exclusively by the primary contractor (providedBySubcontractor = false),
    // there is no supply-chain N-tier relationship to map.
    if (!contract.providedBySubcontractor) {
      throw new BadRequestException(
        'This contract is delivered exclusively by the primary contractor (DORA Art.28§3). ' +
        'ICT dependencies can only be linked to contracts where subcontracting is active. ' +
        'Enable "Provided by Subcontractor" on the contract first.'
      );
    }

    // 3. Check if dependency already exists
    const existing = await this.prisma.functionIctDependency.findFirst({
      where: { functionId: id, contractId },
    });
    if (existing) return existing;

    // 4. Create dependency
    return this.prisma.functionIctDependency.create({
      data: {
        functionId: id,
        contractId: contractId,
      },
      include: {
        contractualArrangement: {
          include: { provider: true, ictServiceType: true },
        },
      },
    });
  }

  async removeIctDependency(id: string, tenantId: string, contractId: string) {
    // 1. Verify business function exists and belongs to tenant
    await this.findOne(id, tenantId);

    // 2. Delete all matching dependencies
    return this.prisma.functionIctDependency.deleteMany({
      where: {
        functionId: id,
        contractId: contractId,
      },
    });
  }
}
