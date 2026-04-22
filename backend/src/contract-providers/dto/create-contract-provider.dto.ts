import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractProviderDto {
  @ApiProperty({ description: 'The contractual arrangement UUID' })
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'The ICT provider UUID (subcontractor or co-provider)' })
  @IsNotEmpty()
  @IsUUID()
  providerId: string;
}
