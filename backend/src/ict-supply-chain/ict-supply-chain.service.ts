import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplyChainDto } from './dto/create-supply-chain.dto';
import { UpdateSupplyChainDto } from './dto/update-supply-chain.dto';

@Injectable()
export class IctSupplyChainService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adjacency List Hierarchy model:
   *  parentChainId = null → direct provider under the contract (Rank 1)
   *  parentChainId = UUID → subcontractor of that specific parent (Rank = ParentRank + 1)
   *
   *  Each row represents one ICT provider acting as a subcontractor.
   *  We build the chain by tracing parentLink recursively.
   */

  async create(tenantId: string, data: CreateSupplyChainDto) {
    // Verify contract ownership
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: data.contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied.');
    }

    let supplyRank = 1;
    if (data.parentChainId) {
      const parent = await this.prisma.ictSupplyChain.findUnique({ where: { id: data.parentChainId } });
      if (!parent || parent.contractId !== data.contractId) {
        throw new BadRequestException('Invalid parent chain entry for this contract.');
      }
      supplyRank = (parent.supplyRank || 1) + 1;
      
      if (parent.providerId === data.providerId) {
        throw new BadRequestException('Provider cannot be a subcontractor to itself.');
      }
    }

    return this.prisma.ictSupplyChain.create({
      data: {
        contractId: data.contractId,
        providerId: data.providerId,
        parentChainId: data.parentChainId || null,
        serviceTypeId: data.serviceTypeId,
        supplyRank: supplyRank,
      },
      include: this.defaultIncludes(),
    });
  }

  /** All chain entries for this tenant — optionally filtered by contract. */
  async findAll(tenantId: string, contractId?: string) {
    return this.prisma.ictSupplyChain.findMany({
      where: {
        contractualArrangement: { tenantId },
        ...(contractId ? { contractId } : {}),
      },
      include: this.defaultIncludes(),
      orderBy: [{ contractId: 'asc' }, { supplyRank: 'asc' }],
    });
  }

  /**
   * Returns the hierarchical chain for one contract, grouped by supplyRank.
   * Clients can render this as a tree: rank 1 → rank 2 → rank N.
   */
  async findChainForContract(contractId: string, tenantId: string) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied.');
    }

    const entries = await this.prisma.ictSupplyChain.findMany({
      where: { contractId },
      include: this.defaultIncludes(),
      orderBy: { supplyRank: 'asc' },
    });

    // Group by supply_rank for a structured hierarchy response
    const byRank: Record<number, typeof entries> = {};
    for (const entry of entries) {
      const rank = entry.supplyRank ?? 1;
      if (!byRank[rank]) byRank[rank] = [];
      byRank[rank].push(entry);
    }

    return { contractId, levels: byRank };
  }

  /**
   * Generates a fully nested recursive Tree representation of the supply chain
   * designed explicitly for the UI visualization component.
   */
  async getTreeForContract(contractId: string, tenantId: string) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: contractId, tenantId },
      include: { provider: true }
    });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied.');
    }

    const flatEntries = await this.prisma.ictSupplyChain.findMany({
      where: { contractId },
      include: { provider: true, serviceType: true },
      orderBy: { supplyRank: 'asc' },
    });

    // We build the tree. The Root is the Primary Provider of the contract.
    const root = {
      id: 'root',
      providerId: contract.providerId,
      providerName: contract.provider?.legalName || contract.provider?.providerCode || 'Primary Provider',
      serviceTypeName: contract.contractType || 'Primary Contract',
      supplyRank: 0,
      contractCount: 0,
      subcontractors: [] as any[]
    };

    // Fast mapping lookup
    const map = new Map<string, any>();
    // Pre-seed the immediate Rank 1 items to look under 'root' if they have no parentChainId
    map.set('root', root);

    flatEntries.forEach(entry => {
      const node = {
        id: entry.id,
        providerId: entry.providerId,
        providerName: entry.provider?.legalName || entry.provider?.providerCode || 'Unknown Provider',
        serviceTypeName: entry.serviceType?.name || 'Unknown Service',
        supplyRank: entry.supplyRank || 1,
        contractCount: 1, // simplified representation
        subcontractors: []
      };
      map.set(entry.id, node);
    });

    flatEntries.forEach(entry => {
      const node = map.get(entry.id);
      const parentId = entry.parentChainId ? entry.parentChainId : 'root';
      const parentNode = map.get(parentId);
      if (parentNode) {
        parentNode.subcontractors.push(node);
      }
    });

    return root;
  }

  async findOne(id: string, tenantId: string) {
    const entry = await this.prisma.ictSupplyChain.findFirst({
      where: { id, contractualArrangement: { tenantId } },
      include: this.defaultIncludes(),
    });
    if (!entry) throw new NotFoundException(`Supply chain entry ${id} not found.`);
    return entry;
  }

  async update(id: string, tenantId: string, data: UpdateSupplyChainDto) {
    const entry = await this.findOne(id, tenantId);

    let supplyRank = data.supplyRank ?? entry.supplyRank;
    
    if (data.parentChainId !== undefined && data.parentChainId !== entry.parentChainId) {
       if (data.parentChainId === id) {
          throw new BadRequestException('Cannot set parent to self.');
       }
       if (data.parentChainId) {
          const parent = await this.prisma.ictSupplyChain.findUnique({ where: { id: data.parentChainId } });
          if (!parent || parent.contractId !== entry.contractId) throw new BadRequestException('Invalid parent chain entry.');
          supplyRank = (parent.supplyRank || 1) + 1;
       } else {
          supplyRank = 1;
       }
    }

    return this.prisma.ictSupplyChain.update({
      where: { id },
      data: {
        ...(data.providerId !== undefined && { providerId: data.providerId }),
        ...(data.parentChainId !== undefined && { parentChainId: data.parentChainId }),
        ...(data.serviceTypeId !== undefined && { serviceTypeId: data.serviceTypeId }),
        supplyRank: supplyRank,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.ictSupplyChain.delete({ where: { id } });
    return { message: `Supply chain entry ${id} deleted.` };
  }

  private defaultIncludes() {
    return {
      provider: { select: { id: true, providerCode: true, legalName: true } },
      parentLink: { select: { id: true, provider: { select: { legalName: true, providerCode: true } } } },
      serviceType: { select: { id: true, name: true } },
      contractualArrangement: { select: { id: true, contractReference: true } },
    };
  }
}
