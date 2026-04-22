import { apiClient } from './auth';

export const TRIGGER_REASONS = [
  { value: 'SCHEDULED_REASSESSMENT',  label: 'Scheduled Reassessment',           icon: '🗓️' },
  { value: 'NEW_CONTRACT_ONBOARDED',  label: 'New Contract / Provider Onboarded', icon: '📋' },
  { value: 'MATERIAL_CONTRACT_CHANGE',label: 'Material Contract Change',          icon: '✏️' },
  { value: 'PROVIDER_RISK_CHANGE',    label: 'Provider / Service Risk Change',    icon: '⚠️' },
  { value: 'VALIDATION_FINDING',      label: 'Validation Finding / Issue',        icon: '🔍' },
  { value: 'SECURITY_INCIDENT',       label: 'Security / Compliance Incident',    icon: '🔒' },
  { value: 'MANUAL_REVIEW',           label: 'Manual Analyst Review',             icon: '👤' },
] as const;

export type TriggerReason = typeof TRIGGER_REASONS[number]['value'];

export const ASSESSMENT_STATUSES = [
  { value: 'ACTIVE',     label: 'Active',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'SUPERSEDED', label: 'Superseded', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-700' },
  { value: 'ARCHIVED',   label: 'Archived',   cls: 'bg-zinc-800 text-zinc-600 border-zinc-700' },
] as const;

export type AssessmentStatus = typeof ASSESSMENT_STATUSES[number]['value'];

export interface IctServiceAssessment {
  id: string;
  contractId: string;
  providerId: string;
  isSubstitutable?: boolean;
  substitutionReason?: string;
  alternativeProvidersExist?: boolean;
  alternativeProviderReference?: string;
  discontinuationImpact?: string;
  exitPlanExists?: boolean;
  reintegrationPossible?: boolean;
  lastAuditDate?: string;
  nextReviewDate?: string;
  triggerReason?: TriggerReason | string;
  assessmentStatus?: string;
  createdAt?: string;

  // Populated relations
  contract?: {
    id: string;
    contractReference: string;
    financialEntity?: { id: string; name: string };
    ictServiceType?: { id: number; name: string };
    relianceLevel?: { id: number; levelName: string };
  };
  provider?: { id: string; providerCode: string; legalName?: string };
}

export const riskAssessmentApi = {
  getAll: async (): Promise<IctServiceAssessment[]> => {
    const res = await apiClient.get('/risk-assessment');
    return res.data;
  },

  getById: async (id: string): Promise<IctServiceAssessment> => {
    const res = await apiClient.get(`/risk-assessment/${id}`);
    return res.data;
  },

  create: async (data: Partial<IctServiceAssessment>): Promise<IctServiceAssessment> => {
    const res = await apiClient.post('/risk-assessment', data);
    return res.data;
  },

  update: async (id: string, data: Partial<IctServiceAssessment>): Promise<IctServiceAssessment> => {
    const res = await apiClient.patch(`/risk-assessment/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/risk-assessment/${id}`);
  },
};
