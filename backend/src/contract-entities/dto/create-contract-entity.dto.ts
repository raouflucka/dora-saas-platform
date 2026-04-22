import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContractEntityDto {
  @ApiProperty({ description: 'The contractual arrangement UUID' })
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  @ApiProperty({ description: 'The financial entity UUID' })
  @IsNotEmpty()
  @IsUUID()
  financialEntityId: string;
}
