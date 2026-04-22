import api from './axios';

export interface DashboardStats {
  metrics: {
    entities: number;
    providers: number;
    contracts: number;
    services: number;
  };
  insights: {
    providersMissingLEI: number;
    contractsEndingSoon: number;
    missingLEIDetails: Array<{ id: string; legalName: string }>;
    expiringContractsDetails: Array<{ id: string; contractReference: string; endDate: string; provider: { legalName: string } }>;
  };
  validation: {
    latestRunId: string | null;
    executedAt: string | null;
    totalErrors: number;
    totalWarnings: number;
    flaggedIssues: number;
    isExportReady: boolean;
  };
  risk: {
    score: number; // 0–100
    concentrationRisks: Array<{ providerId: string; providerName: string; contractCount: number }>;
  };
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/dashboard/stats');
    return res.data;
  },
};
