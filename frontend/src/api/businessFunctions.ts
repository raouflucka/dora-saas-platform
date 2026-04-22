import api from './axios';

export interface BusinessFunction {
  id: string;
  tenantId: string;
  financialEntityId: string;
  functionIdentifier: string;
  functionName: string;
  criticalityLevelId?: number;
  criticalityReason?: string;
  licensedActivity?: string;
  impactDiscontinuation?: string;
  rto?: number;
  rpo?: number;
  lastAssessmentDate?: string;
  createdAt?: string;
  // Relations
  financialEntity?: { id: string; name: string; lei: string };
  criticalityLevel?: { id: number; levelName: string };
  ictDependencies?: any[];
}

export const businessFunctionsApi = {
  getAll: async (): Promise<BusinessFunction[]> => {
    const response = await api.get('/business-functions');
    return response.data;
  },
  getById: async (id: string): Promise<BusinessFunction> => {
    const response = await api.get(`/business-functions/${id}`);
    return response.data;
  },
  create: async (data: Partial<BusinessFunction>): Promise<BusinessFunction> => {
    const response = await api.post('/business-functions', data);
    return response.data;
  },
  update: async (id: string, data: Partial<BusinessFunction>): Promise<BusinessFunction> => {
    const response = await api.patch(`/business-functions/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/business-functions/${id}`);
  },
  addIctDependency: async (id: string, contractId: string): Promise<any> => {
    const response = await api.post(`/business-functions/${id}/dependencies`, { contractId });
    return response.data;
  },
  removeIctDependency: async (id: string, contractId: string): Promise<void> => {
    await api.delete(`/business-functions/${id}/dependencies/${contractId}`);
  },
};
