import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Bank Ireland' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '969500T3MBS4SQAMHJ45', description: 'Legal Entity Identifier (20 chars)' })
  @IsOptional()
  @IsString()
  @Length(20, 20)
  lei?: string;

  @ApiPropertyOptional({ example: 'IE', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
