import {
  Controller, Get, Post, Body, Patch, Delete,
  Param, UseGuards, Request, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MailerService } from '../common/mailer/mailer.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailerService: MailerService,
  ) {}

  @Roles('ADMIN')
  @Get()
  @ApiOperation({ summary: 'List all users in the calling admin\'s tenant' })
  findAll(@Request() req) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Roles('ADMIN')
  @Get(':id')
  @ApiOperation({ summary: 'Get a single user (within same tenant)' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Roles('ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user email and/or password' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { email?: string; password?: string },
    @Request() req,
  ) {
    return this.usersService.update(id, req.user.tenantId, dto);
  }

  @Roles('ADMIN')
  @Patch(':id/role')
  @ApiOperation({ summary: 'Assign a new role to a user' })
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req,
  ) {
    return this.usersService.updateRole(id, req.user.tenantId, dto.role);
  }

  @Roles('ADMIN')
  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user (soft-delete — credentials invalidated)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    if (id === req.user.id) throw new Error('Cannot deactivate yourself');
    return this.usersService.deactivate(id, req.user.tenantId);
  }

  @Roles('ADMIN')
  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a deactivated user' })
  activate(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.usersService.activate(id, req.user.tenantId);
  }

  @Roles('ADMIN')
  @Delete(':id/hard')
  @ApiOperation({ summary: 'Permanently delete a user' })
  deleteHard(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    if (id === req.user.id) throw new Error('Cannot delete yourself');
    return this.usersService.delete(id, req.user.tenantId);
  }

  @Roles('ADMIN')
  @Post('invite')
  @ApiOperation({ summary: 'Invite a new user to this tenant via email' })
  async invite(@Body() dto: InviteUserDto, @Request() req) {
    const { userId, tempPassword } = await this.usersService.inviteUser(
      req.user.tenantId,
      dto,
    );
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:8000'}/login`;
    await this.mailerService.sendMail(
      dto.email,
      'You\'ve been invited to DORA SaaS',
      `
      <h1>Welcome to DORA SaaS</h1>
      <p>Hello ${dto.fullName || dto.email},</p>
      <p>You have been invited to access the DORA compliance platform with the role <strong>${dto.role}</strong>.</p>
      <p>Your temporary credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${dto.email}</li>
        <li><strong>Temporary Password:</strong> <code>${tempPassword}</code></li>
      </ul>
      <p><a href="${loginUrl}">Login to DORA SaaS</a></p>
      <p>You will be prompted to change your password on first login.</p>
      <p><em>This password expires in 7 days.</em></p>
      `,
    );
    return { message: `Invitation sent to ${dto.email}.`, userId };
  }
}
