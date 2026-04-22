import { apiClient } from './auth';

export interface ContractEntityLink {
  id: string;
  contractId: string;
  financialEntityId: string;
  financialEntity?: { id: string; name: string; lei: string; country?: string };
  contract?: { id: string; contractReference: string };
}

export interface ContractProviderLink {
  id: string;
  contractId: string;
  providerId: string;
  provider?: { id: string; providerCode: string; legalName: string; lei: string; headquartersCountry?: string };
  contract?: { id: string; contractReference: string };
}

export const contractEntitiesApi = {
  getByContract: async (contractId: string): Promise<ContractEntityLink[]> => {
    const res = await apiClient.get('/contract-entities', { params: { contractId } });
    return res.data;
  },
  add: async (contractId: string, financialEntityId: string): Promise<ContractEntityLink> => {
    const res = await apiClient.post('/contract-entities', { contractId, financialEntityId });
    return res.data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/contract-entities/${id}`);
  },
};

export const contractProvidersApi = {
  getByContract: async (contractId: string): Promise<ContractProviderLink[]> => {
    const res = await apiClient.get('/contract-providers', { params: { contractId } });
    return res.data;
  },
  add: async (contractId: string, providerId: string): Promise<ContractProviderLink> => {
    const res = await apiClient.post('/contract-providers', { contractId, providerId });
    return res.data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/contract-providers/${id}`);
  },
};
