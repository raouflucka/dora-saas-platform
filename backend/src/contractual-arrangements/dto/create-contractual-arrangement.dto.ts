import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, IsBoolean, Length, IsDateString } from 'class-validator';

export class CreateContractualArrangementDto {
  @IsUUID()
  @IsNotEmpty()
  financialEntityId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  contractReference: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  contractType?: string;

  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @IsUUID()
  @IsOptional()
  subcontractorProviderId?: string;

  @IsInt()
  @IsOptional()
  ictServiceTypeId?: number;

  @IsInt()
  @IsOptional()
  relianceLevelId?: number;

  @IsInt()
  @IsOptional()
  dataSensitivityId?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  renewalTerms?: string;

  @IsInt()
  @IsOptional()
  terminationNoticePeriod?: number;

  @IsString()
  @IsOptional()
  serviceDescription?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  governingLawCountry?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  serviceCountry?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  processingLocation?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  storageLocation?: string;

  @IsBoolean()
  @IsOptional()
  dataStorage?: boolean;

  @IsBoolean()
  @IsOptional()
  providedByContractor?: boolean;

  @IsBoolean()
  @IsOptional()
  providedBySubcontractor?: boolean;

  @IsString()
  @IsOptional()
  @Length(1, 3)
  currency?: string;

  @IsOptional()
  annualCost?: number;
}
