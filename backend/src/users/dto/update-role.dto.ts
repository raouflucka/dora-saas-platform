import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ example: 'ANALYST', enum: ['ADMIN', 'ANALYST', 'EDITOR'] })
  @IsIn(['ADMIN', 'ANALYST', 'EDITOR'])
  role: string;
}
