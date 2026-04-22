import { apiClient } from './auth';

export interface PreflightResult {
  exportReady: boolean;
  totalErrors: number;
  totalWarnings: number;
  runId: string;
}

export interface TemplateInfo {
  code: string;
}

export const roiExportApi = {
  getTemplates: async (): Promise<{ templates: TemplateInfo[] }> => {
    const res = await apiClient.get('/roi/templates');
    return res.data;
  },

  preflight: async (): Promise<PreflightResult> => {
    const res = await apiClient.get('/roi/preflight');
    return res.data;
  },

  downloadExcel: async (template?: string): Promise<Blob> => {
    const params = template ? { template } : {};
    const res = await apiClient.get('/roi/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  downloadXbrl: async (): Promise<Blob> => {
    const res = await apiClient.get('/roi/export/xbrl', {
      responseType: 'blob',
    });
    return res.data;
  },
};

