import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractEntityDto } from './dto/create-contract-entity.dto';

@Injectable()
export class ContractEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Link a financial entity to a contractual arrangement.
   * Verifies ownership via tenantId on both the contract and the entity.
   * Implements EBA RT.03 — list of entities party to a contract.
   */
  async create(tenantId: string, dto: CreateContractEntityDto) {
    // Ownership check — contract must belong to this tenant
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: dto.contractId, tenantId },
    });
    if (!contract) throw new NotFoundException('Contract not found or access denied');

    // Ownership check — entity must belong to this tenant
    const entity = await this.prisma.financialEntity.findFirst({
      where: { id: dto.financialEntityId, tenantId },
    });
    if (!entity) throw new NotFoundException('Financial entity not found or access denied');

    // Prevent duplicates (schema has @@unique constraint but surface a nice error)
    const existing = await this.prisma.contractEntity.findFirst({
      where: { contractId: dto.contractId, financialEntityId: dto.financialEntityId },
    });
    if (existing) throw new ConflictException('This entity is already linked to this contract');

    return this.prisma.contractEntity.create({
      data: {
        contractId: dto.contractId,
        financialEntityId: dto.financialEntityId,
      },
      include: {
        financialEntity: { select: { id: true, name: true, lei: true } },
        contract: { select: { id: true, contractReference: true } },
      },
    });
  }

  /**
   * List all entities linked to a specific contract.
   * Tenant isolation via contract.tenantId join.
   */
  async findByContract(contractId: string, tenantId: string) {
    // Verify contract ownership first
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) throw new NotFoundException('Contract not found or access denied');

    return this.prisma.contractEntity.findMany({
      where: { contractId },
      include: {
        financialEntity: { select: { id: true, name: true, lei: true, country: true } },
      },
      orderBy: { financialEntity: { name: 'asc' } },
    });
  }

  /**
   * Remove a financial entity link from a contract.
   * Verifies the entry belongs to this tenant via contract.
   */
  async remove(id: string, tenantId: string) {
    const entry = await this.prisma.contractEntity.findFirst({
      where: { id },
      include: { contract: { select: { tenantId: true } } },
    });
    if (!entry || entry.contract.tenantId !== tenantId) {
      throw new NotFoundException('Contract entity link not found or access denied');
    }
    return this.prisma.contractEntity.delete({ where: { id } });
  }
}
