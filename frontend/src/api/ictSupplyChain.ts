import { apiClient } from './auth';

export interface SupplyChainEntry {
  id: string;
  contractId: string;
  providerId: string;
  parentChainId?: string;
  serviceTypeId?: number;
  supplyRank: number;
  provider: { id: string; providerCode: string; legalName?: string };
  parentLink?: { id: string; provider: { id: string; providerCode: string; legalName?: string } };
  serviceType?: { id: number; name: string };
  contractualArrangement: { id: string; contractReference: string };
}

export interface ChainHierarchy {
  contractId: string;
  levels: Record<number, SupplyChainEntry[]>;
}

export const ictSupplyChainApi = {
  getAll: async (contractId?: string): Promise<SupplyChainEntry[]> => {
    const params = contractId ? { contractId } : {};
    const res = await apiClient.get('/ict-supply-chain', { params });
    return res.data;
  },

  getChain: async (contractId: string): Promise<ChainHierarchy> => {
    const res = await apiClient.get(`/ict-supply-chain/chain/${contractId}`);
    return res.data;
  },

  getTree: async (contractId: string): Promise<any> => {
    const res = await apiClient.get(`/ict-supply-chain/tree/${contractId}`);
    return res.data;
  },

  getById: async (id: string): Promise<SupplyChainEntry> => {
    const res = await apiClient.get(`/ict-supply-chain/${id}`);
    return res.data;
  },

  create: async (data: {
    contractId: string;
    providerId: string;
    parentChainId?: string;
    serviceTypeId?: number;
    supplyRank?: number;
  }): Promise<SupplyChainEntry> => {
    const res = await apiClient.post('/ict-supply-chain', data);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/ict-supply-chain/${id}`);
  },
};
