import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIctProviderDto } from './dto/create-ict-provider.dto';
import { UpdateIctProviderDto } from './dto/update-ict-provider.dto';

@Injectable()
export class IctProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: CreateIctProviderDto) {
    if (data.parentProviderId) {
      const parent = await this.prisma.ictProvider.findFirst({
        where: { id: data.parentProviderId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException('Parent provider not found or does not belong to your tenant.');
      }
    }

    return this.prisma.ictProvider.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.ictProvider.findMany({
      where: { tenantId },
      include: {
        personType: true,
        headquartersRef: true,
        currencyRef: true,
        parentProvider: true,
      },
      orderBy: { providerCode: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const provider = await this.prisma.ictProvider.findFirst({
      where: { id, tenantId },
      include: {
        personType: true,
        headquartersRef: true,
        currencyRef: true,
        childProviders: true,
      },
    });

    if (!provider) {
      throw new NotFoundException(`ICT Provider with id ${id} not found.`);
    }

    return provider;
  }

  async update(id: string, tenantId: string, data: UpdateIctProviderDto) {
    await this.findOne(id, tenantId); // ensure existence and ownership

    if (data.parentProviderId) {
      const parent = await this.prisma.ictProvider.findFirst({
        where: { id: data.parentProviderId, tenantId },
      });
      if (!parent) {
        throw new NotFoundException('Parent provider not found or does not belong to your tenant.');
      }
    }

    return this.prisma.ictProvider.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId); // ensure existence and ownership
    
    return this.prisma.ictProvider.delete({
      where: { id },
    });
  }
}
