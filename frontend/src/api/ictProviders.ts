import { apiClient } from './auth';

export interface IctProvider {
  id: string;
  providerCode: string;
  legalName?: string;
  latinName?: string;
  personTypeId?: number;
  headquartersCountry?: string;
  currency?: string;
  annualCost?: number;
  parentProviderId?: string;
  lei?: string;
  naceCode?: string;
  ultimateParentLei?: string;
  intraGroupFlag?: boolean;
  competentAuthority?: string;
  headquartersRef?: { code: string; name: string };
  currencyRef?: { code: string; name: string };
  personType?: { id: number; name: string };
  createdAt: string;
}

export const ictProvidersApi = {
  getAll: async (): Promise<IctProvider[]> => {
    const response = await apiClient.get('/ict-providers');
    return response.data;
  },
  
  getById: async (id: string): Promise<IctProvider> => {
    const response = await apiClient.get(`/ict-providers/${id}`);
    return response.data;
  },
  
  create: async (data: Partial<IctProvider>): Promise<IctProvider> => {
    const response = await apiClient.post('/ict-providers', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<IctProvider>): Promise<IctProvider> => {
    const response = await apiClient.patch(`/ict-providers/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/ict-providers/${id}`);
  }
};
