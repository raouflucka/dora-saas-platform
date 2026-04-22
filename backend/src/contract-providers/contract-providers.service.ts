import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractProviderDto } from './dto/create-contract-provider.dto';

@Injectable()
export class ContractProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Link an additional provider (subcontractor / co-signatory) to a contract.
   * EBA RT.02 — Annex III: all ICT providers with contractual link must be declared.
   * Tenant isolation via contract.tenantId.
   */
  async create(tenantId: string, dto: CreateContractProviderDto) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: dto.contractId, tenantId },
    });
    if (!contract) throw new NotFoundException('Contract not found or access denied');

    const provider = await this.prisma.ictProvider.findFirst({
      where: { id: dto.providerId, tenantId },
    });
    if (!provider) throw new NotFoundException('ICT Provider not found or access denied');

    const existing = await this.prisma.contractProvider.findFirst({
      where: { contractId: dto.contractId, providerId: dto.providerId },
    });
    if (existing) throw new ConflictException('This provider is already linked to this contract');

    return this.prisma.contractProvider.create({
      data: {
        contractId: dto.contractId,
        providerId: dto.providerId,
      },
      include: {
        provider: { select: { id: true, providerCode: true, legalName: true, lei: true } },
        contract: { select: { id: true, contractReference: true } },
      },
    });
  }

  /**
   * List all additional providers linked to a contract.
   * Tenant isolation via contract ownership check.
   */
  async findByContract(contractId: string, tenantId: string) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) throw new NotFoundException('Contract not found or access denied');

    return this.prisma.contractProvider.findMany({
      where: { contractId },
      include: {
        provider: { select: { id: true, providerCode: true, legalName: true, lei: true, headquartersCountry: true } },
      },
      orderBy: { provider: { legalName: 'asc' } },
    });
  }

  /**
   * Remove a provider link from a contract.
   */
  async remove(id: string, tenantId: string) {
    const entry = await this.prisma.contractProvider.findFirst({
      where: { id },
      include: { contract: { select: { tenantId: true } } },
    });
    if (!entry || entry.contract.tenantId !== tenantId) {
      throw new NotFoundException('Contract provider link not found or access denied');
    }
    return this.prisma.contractProvider.delete({ where: { id } });
  }
}
