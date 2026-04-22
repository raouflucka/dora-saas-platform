import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
} from 'class-validator';

export const TRIGGER_REASONS = [
  'SCHEDULED_REASSESSMENT',
  'NEW_CONTRACT_ONBOARDED',
  'MATERIAL_CONTRACT_CHANGE',
  'PROVIDER_RISK_CHANGE',
  'VALIDATION_FINDING',
  'SECURITY_INCIDENT',
  'MANUAL_REVIEW',
] as const;

export type TriggerReason = typeof TRIGGER_REASONS[number];

export const ASSESSMENT_STATUSES = ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'] as const;
export type AssessmentStatus = typeof ASSESSMENT_STATUSES[number];

export class CreateAssessmentDto {
  @IsUUID()
  contractId: string;

  @IsUUID()
  providerId: string;

  @IsOptional()
  @IsBoolean()
  isSubstitutable?: boolean;

  @IsOptional()
  @IsString()
  substitutionReason?: string;

  @IsOptional()
  @IsBoolean()
  alternativeProvidersExist?: boolean;

  @IsOptional()
  @IsString()
  alternativeProviderReference?: string;

  @IsOptional()
  @IsString()
  discontinuationImpact?: string;

  @IsOptional()
  @IsBoolean()
  exitPlanExists?: boolean;

  @IsOptional()
  @IsBoolean()
  reintegrationPossible?: boolean;

  @IsOptional()
  @IsDateString()
  lastAuditDate?: string;

  @IsOptional()
  @IsDateString()
  nextReviewDate?: string;

  @IsOptional()
  @IsIn(TRIGGER_REASONS)
  triggerReason?: string;

  @IsOptional()
  @IsIn(ASSESSMENT_STATUSES)
  assessmentStatus?: string;
}
