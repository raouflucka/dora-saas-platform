import { apiClient } from './auth';

export interface FinancialEntity {
  id: string;
  name: string;
  lei: string;
  entityTypeId?: number;
  country?: string;
  currency?: string;
  parentEntityId?: string;
  integrationDate?: string;
  deletionDate?: string;
  totalAssets?: number;
  countryRef?: { code: string; name: string };
  currencyRef?: { code: string; name: string };
  createdAt: string;
}

export const financialEntitiesApi = {
  getAll: async (): Promise<FinancialEntity[]> => {
    const response = await apiClient.get('/financial-entities');
    return response.data;
  },
  
  getById: async (id: string): Promise<FinancialEntity> => {
    const response = await apiClient.get(`/financial-entities/${id}`);
    return response.data;
  },
  
  create: async (data: Partial<FinancialEntity>): Promise<FinancialEntity> => {
    const response = await apiClient.post('/financial-entities', data);
    return response.data;
  },
  
  update: async (id: string, data: Partial<FinancialEntity>): Promise<FinancialEntity> => {
    const response = await apiClient.patch(`/financial-entities/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/financial-entities/${id}`);
  }
};
