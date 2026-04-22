import { apiClient } from './auth';

export interface ExitStrategy {
  id: string;
  contractId: string;
  exitTrigger: string;
  exitStrategy: string;
  fallbackProviderId?: string;
  assessmentId?: string;
  createdAt: string;
  contract?: { id: string; contractReference: string };
  fallbackProvider?: { id: string; providerCode: string; legalName?: string };
}

export const exitStrategiesApi = {
  getAll: async (contractId?: string): Promise<ExitStrategy[]> => {
    const params = contractId ? { contractId } : {};
    const res = await apiClient.get('/exit-strategies', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ExitStrategy> => {
    const res = await apiClient.get(`/exit-strategies/${id}`);
    return res.data;
  },

  create: async (data: Partial<ExitStrategy>): Promise<ExitStrategy> => {
    const res = await apiClient.post('/exit-strategies', data);
    return res.data;
  },

  update: async (id: string, data: Partial<ExitStrategy>): Promise<ExitStrategy> => {
    const res = await apiClient.patch(`/exit-strategies/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/exit-strategies/${id}`);
  },
};
