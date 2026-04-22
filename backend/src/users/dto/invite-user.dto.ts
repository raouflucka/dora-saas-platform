import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({ example: 'analyst@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Jane Analyst', description: 'Full name of the invitee' })
  @IsOptional()
  fullName?: string;

  @ApiProperty({ example: 'ANALYST', enum: ['ADMIN', 'ANALYST', 'EDITOR'] })
  @IsIn(['ADMIN', 'ANALYST', 'EDITOR'])
  role: string;
}
