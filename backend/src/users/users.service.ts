import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/auth.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** List all users in a tenant with role names */
  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        role: { select: { roleName: true } },
        resetToken: false,
        passwordHash: false,
        resetTokenExpires: false,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Get one user, verifying tenant ownership */
  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        role: { select: { roleName: true } },
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found.`);
    return user;
  }

  /** Create a new user (used during auth registration) */
  async create(data: RegisterDto & { roleId?: number; tenantId?: string }) {
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltOrRounds);

    let tenantId = data.tenantId;
    if (!tenantId) {
      const tenant = await this.prisma.tenant.findFirst();
      if (tenant) {
        tenantId = tenant.id;
      } else {
        const newTenant = await this.prisma.tenant.create({
          data: { name: 'Default Tenant' },
        });
        tenantId = newTenant.id;
      }
    }

    let roleId = data.roleId;
    if (!roleId) {
      const role = await this.prisma.userRole.findFirst({ where: { roleName: 'ANALYST' } });
      if (role) roleId = role.id;
    }

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        tenantId: tenantId!,
        roleId: data.roleId || 2,
        fullName: data.fullName || data.email.split('@')[0],
      },
    });
  }

  /** Assign a new role to an existing user */
  async updateRole(id: string, tenantId: string, roleName: string) {
    await this.findOne(id, tenantId);
    const role = await this.prisma.userRole.findFirst({ where: { roleName } });
    if (!role) throw new NotFoundException(`Role ${roleName} not found.`);
    return this.prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      select: { id: true, email: true, fullName: true, role: { select: { roleName: true } } },
    });
  }

  /* Update user (email, password) */
  async update(id: string, tenantId: string, data: { email?: string; password?: string }) {
    await this.findOne(id, tenantId);
    const updateData: any = {};
    if (data.email) updateData.email = data.email.trim().toLowerCase();
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      updateData.resetToken = null;
    }
    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true },
    });
  }

  /** Deactivate a user by clearing credentials (soft delete) */
  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    // Mark as deactivated — set a tombstone token so login fails on bcrypt compare
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: 'DEACTIVATED', resetToken: null, resetTokenExpires: null },
    });
    return { message: `User ${id} has been deactivated.` };
  }

  /** Activate a user */
  async activate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: 'PENDING_RESET', resetToken: crypto.randomBytes(32).toString('hex'), resetTokenExpires: new Date(Date.now() + 7 * 24 * 3600000) },
    });
    return { message: `User ${id} activated. A password reset is required.` };
  }

  /** Hard Delete a user */
  async delete(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.user.delete({ where: { id } });
    return { message: `User ${id} permanently deleted.` };
  }

  /**
   * Invite a new user:
   * 1. Check email not already used
   * 2. Generate a temporary password (reset token flow)
   * 3. Create user with the given role
   * 4. Return the temp password so the caller can email it
   */
  async inviteUser(tenantId: string, dto: InviteUserDto): Promise<{ userId: string; tempPassword: string }> {
    const existing = await this.findByEmail(dto.email.trim().toLowerCase());
    if (existing) throw new ConflictException(`${dto.email} is already registered.`);

    const role = await this.prisma.userRole.findFirst({ where: { roleName: dto.role } });
    if (!role) throw new NotFoundException(`Role ${dto.role} not found.`);

    // Generate a secure temp password
    const tempPassword = crypto.randomBytes(10).toString('hex'); // 20-char hex
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName || dto.email.split('@')[0],
        passwordHash: hashedPassword,
        tenantId,
        roleId: role.id,
        // Pre-set a reset token so the user is forced to change their password on first login
        resetToken: crypto.randomBytes(32).toString('hex'),
        resetTokenExpires: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
      },
    });

    return { userId: user.id, tempPassword };
  }
}
