import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, Length, IsDateString, IsNumber } from 'class-validator';

export class CreateFinancialEntityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(20, 20)
  lei: string;

  @IsInt()
  @IsOptional()
  entityTypeId?: number;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string;

  @IsUUID()
  @IsOptional()
  parentEntityId?: string;

  @IsDateString()
  @IsOptional()
  integrationDate?: string;

  @IsDateString()
  @IsOptional()
  deletionDate?: string;

  @IsNumber()
  @IsOptional()
  totalAssets?: number;
}
