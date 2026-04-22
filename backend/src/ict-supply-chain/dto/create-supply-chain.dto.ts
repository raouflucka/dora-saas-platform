import { IsUUID, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplyChainDto {
  @ApiProperty({ description: 'Contract this chain entry belongs to' })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ description: 'The subcontractor provider being added' })
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @ApiPropertyOptional({ description: 'The parent IctSupplyChain ID who hired this provider. Null if hired by the main contract provider.' })
  @IsUUID()
  @IsOptional()
  parentChainId?: string;

  @ApiPropertyOptional({ description: 'FK to ict_service_types' })
  @IsInt()
  @IsOptional()
  serviceTypeId?: number;

  @ApiPropertyOptional({
    description: 'Hierarchy depth: 1 = direct provider, 2 = subcontractor, 3 = N-th party…',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  supplyRank?: number;
}
