import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, Length, IsNumber, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIctProviderDto {
  @IsString()
  @IsNotEmpty()
  providerCode: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsString()
  @IsOptional()
  latinName?: string;

  @IsInt()
  @IsOptional()
  personTypeId?: number;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  headquartersCountry?: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string;

  @IsNumber()
  @IsOptional()
  annualCost?: number;

  @IsUUID()
  @IsOptional()
  parentProviderId?: string;

  @ApiPropertyOptional({ description: 'Legal Entity Identifier (EBA RT.03 B_09.03)', maxLength: 20 })
  @IsString()
  @IsOptional()
  @Length(20, 20)
  lei?: string;

  @ApiPropertyOptional({ description: 'NACE economic activity code (EBA RT.03 B_09.04)' })
  @IsString()
  @IsOptional()
  naceCode?: string;

  @ApiPropertyOptional({ description: 'LEI of the ultimate parent entity (EBA RT.03 B_09.05)', maxLength: 20 })
  @IsString()
  @IsOptional()
  @Length(20, 20)
  ultimateParentLei?: string;

  @ApiPropertyOptional({ description: 'Whether this is an intra-group arrangement (DORA Art. 28§3)' })
  @IsBoolean()
  @IsOptional()
  intraGroupFlag?: boolean;

  @ApiPropertyOptional({ description: 'Name of the competent authority supervising this provider (EBA RT.03 B_09.09)' })
  @IsString()
  @IsOptional()
  competentAuthority?: string;
}
