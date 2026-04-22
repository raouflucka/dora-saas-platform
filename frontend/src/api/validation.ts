import { apiClient } from './auth';

export interface ValidationResult {
  ruleId: string;
  templateName: string;
  fieldName: string;
  ruleType: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  recordId?: string;
  status?: 'OPEN' | 'FLAGGED' | 'WAITING_APPROVAL' | 'FIXED' | 'RESOLVED' | 'REJECTED';
  // Phase 11 & Phase 12 enriched context
  entityType?: string;
  entityName?: string;
  flagComment?: string;
  editorNote?: string;
  suggestedAction?: string;
  frontendRoute?: string;
  invalidValue?: string;
  newValue?: string;
  doraArticle?: string;
  errorCategory?: string;
}

export interface ValidationRunSummary {
  runId: string;
  tenantId: string;
  executedAt: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  results: ValidationResult[];
}

export interface ValidationRunListItem {
  id: string;
  tenantId: string;
  executedAt: string;
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
}

export interface ValidationRunDetail extends ValidationRunListItem {
  results: ValidationResult[];
}

export const validationApi = {
  getRules: async () => {
    const res = await apiClient.get('/validation/rules');
    return res.data;
  },

  runValidation: async (): Promise<ValidationRunSummary> => {
    const res = await apiClient.post('/validation/run');
    return res.data;
  },

  getRunHistory: async (): Promise<ValidationRunListItem[]> => {
    const res = await apiClient.get('/validation/runs');
    return res.data;
  },

  getRunById: async (id: string): Promise<ValidationRunDetail> => {
    const res = await apiClient.get(`/validation/runs/${id}`);
    return res.data;
  },

  flagIssue: async (runId: string, ruleId: string, recordId: string, comment?: string) => {
    const res = await apiClient.patch(`/validation/runs/${runId}/flag`, { ruleId, recordId, comment });
    return res.data;
  },

  resolveIssue: async (runId: string, ruleId: string, recordId: string, note?: string) => {
    const res = await apiClient.patch(`/validation/runs/${runId}/resolve`, { ruleId, recordId, note });
    return res.data;
  },

  approveIssue: async (runId: string, ruleId: string, recordId: string) => {
    const res = await apiClient.patch(`/validation/runs/${runId}/approve`, { ruleId, recordId });
    return res.data;
  },

  rejectIssue: async (runId: string, ruleId: string, recordId: string, reason?: string) => {
    const res = await apiClient.patch(`/validation/runs/${runId}/reject`, { ruleId, recordId, reason });
    return res.data;
  },
};
