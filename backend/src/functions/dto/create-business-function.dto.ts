import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUUID,
  Length,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateBusinessFunctionDto {
  @IsUUID()
  @IsNotEmpty()
  financialEntityId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  functionIdentifier: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  functionName: string;

  @IsInt()
  @IsOptional()
  criticalityLevelId?: number;

  @IsString()
  @IsOptional()
  criticalityReason?: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  licensedActivity?: string;

  @IsString()
  @IsOptional()
  impactDiscontinuation?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  rto?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  rpo?: number;

  @IsDateString()
  @IsOptional()
  lastAssessmentDate?: string;
}
