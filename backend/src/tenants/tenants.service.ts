import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new tenant */
  async create(dto: CreateTenantDto) {
    if (dto.lei) {
      const existing = await this.prisma.tenant.findFirst({ where: { lei: dto.lei } });
      if (existing) throw new ConflictException(`A tenant with LEI ${dto.lei} already exists.`);
    }
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        lei: dto.lei,
        country: dto.country,
      },
    });
  }

  /** List all tenants (ADMIN cross-tenant view) */
  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { users: true, financialEntities: true, contractualArrangements: true },
        },
      },
    });
  }

  /** Get a single tenant by ID */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, financialEntities: true, contractualArrangements: true },
        },
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found.`);
    return tenant;
  }

  /** Update tenant metadata */
  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: dto });
  }

  /** Delete a tenant (cascades via DB constraints) */
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.delete({ where: { id } });
  }
}
