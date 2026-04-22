import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIctServiceDto {
  @ApiProperty({ description: 'ICT Provider this service belongs to' })
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({ description: 'Name of the ICT service' })
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiPropertyOptional({ description: 'Detailed description of the service' })
  @IsString()
  @IsOptional()
  serviceDescription?: string;

  @ApiPropertyOptional({ description: 'FK to ict_service_types' })
  @IsInt()
  @IsOptional()
  serviceTypeId?: number;

  @ApiPropertyOptional({ description: 'FK to criticality_levels' })
  @IsInt()
  @IsOptional()
  criticalityLevelId?: number;

  @ApiPropertyOptional({ description: 'FK to data_sensitivity_levels' })
  @IsInt()
  @IsOptional()
  dataSensitivityId?: number;
}
