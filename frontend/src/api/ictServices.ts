import { apiClient } from './auth';

export interface IctService {
  id: string;
  providerId: string;
  serviceName: string;
  serviceDescription?: string;
  serviceTypeId?: number;
  criticalityLevelId?: number;
  dataSensitivityId?: number;
  provider?: { id: string; providerCode: string; legalName?: string };
  serviceType?: { id: number; name: string };
  criticalityLevel?: { id: number; levelName: string };
  dataSensitivity?: { id: number; levelName: string };
}

export const ictServicesApi = {
  getAll: async (providerId?: string): Promise<IctService[]> => {
    const params = providerId ? { providerId } : {};
    const res = await apiClient.get('/ict-services', { params });
    return res.data;
  },

  getById: async (id: string): Promise<IctService> => {
    const res = await apiClient.get(`/ict-services/${id}`);
    return res.data;
  },

  create: async (data: Partial<IctService>): Promise<IctService> => {
    const res = await apiClient.post('/ict-services', data);
    return res.data;
  },

  update: async (id: string, data: Partial<IctService>): Promise<IctService> => {
    const res = await apiClient.patch(`/ict-services/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/ict-services/${id}`);
  },
};
