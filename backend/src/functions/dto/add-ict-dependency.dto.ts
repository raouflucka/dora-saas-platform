import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddIctDependencyDto {
  @ApiProperty({ description: 'The ID of the Contractual Arrangement' })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;
}
