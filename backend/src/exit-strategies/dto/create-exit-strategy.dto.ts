import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExitStrategyDto {
  @ApiProperty({ description: 'Contractual Arrangement this exit strategy covers' })
  @IsUUID()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ description: 'Condition or event that triggers this exit (e.g. insolvency, SLA breach)' })
  @IsString()
  @IsNotEmpty()
  exitTrigger: string;

  @ApiProperty({ description: 'Detailed exit plan: steps, timeline, responsible party' })
  @IsString()
  @IsNotEmpty()
  exitStrategy: string;

  @ApiPropertyOptional({ description: 'Alternative ICT provider to fall back to' })
  @IsUUID()
  @IsOptional()
  fallbackProviderId?: string;

  @ApiPropertyOptional({ description: 'Link to the ICT Service Assessment that triggered this exit plan' })
  @IsUUID()
  @IsOptional()
  assessmentId?: string;
}
