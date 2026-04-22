import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExitStrategyDto } from './dto/create-exit-strategy.dto';
import { UpdateExitStrategyDto } from './dto/update-exit-strategy.dto';

@Injectable()
export class ExitStrategiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateExitStrategyDto) {
    const contract = await this.prisma.contractualArrangement.findFirst({
      where: { id: data.contractId, tenantId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found or access denied.');
    }

    if (data.fallbackProviderId) {
      const provider = await this.prisma.ictProvider.findFirst({
        where: { id: data.fallbackProviderId, tenantId },
      });
      if (!provider) {
        throw new NotFoundException('Fallback provider not found or access denied.');
      }
    }

    return this.prisma.exitStrategy.create({
      data: {
        tenantId,
        contractId: data.contractId,
        exitTrigger: data.exitTrigger,
        exitStrategy: data.exitStrategy,
        fallbackProviderId: data.fallbackProviderId,
        assessmentId: data.assessmentId,
      },
      include: this.defaultIncludes(),
    });
  }

  async findAll(tenantId: string, contractId?: string) {
    return this.prisma.exitStrategy.findMany({
      where: {
        tenantId,
        ...(contractId ? { contractId } : {}),
      },
      include: this.defaultIncludes(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const strategy = await this.prisma.exitStrategy.findFirst({
      where: { id, tenantId },
      include: this.defaultIncludes(),
    });
    if (!strategy) throw new NotFoundException(`Exit strategy ${id} not found.`);
    return strategy;
  }

  async update(id: string, tenantId: string, data: UpdateExitStrategyDto) {
    await this.findOne(id, tenantId);

    return this.prisma.exitStrategy.update({
      where: { id },
      data: {
        ...(data.exitTrigger !== undefined && { exitTrigger: data.exitTrigger }),
        ...(data.exitStrategy !== undefined && { exitStrategy: data.exitStrategy }),
        ...(data.fallbackProviderId !== undefined && { fallbackProviderId: data.fallbackProviderId }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.exitStrategy.delete({ where: { id } });
    return { message: `Exit strategy ${id} deleted.` };
  }

  private defaultIncludes() {
    return {
      contract: { select: { id: true, contractReference: true } },
      fallbackProvider: { select: { id: true, providerCode: true, legalName: true } },
    };
  }
}
