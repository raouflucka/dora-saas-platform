import { apiClient } from './auth';

export interface ContractualArrangement {
  id: string;
  contractReference: string;
  contractType?: string;
  financialEntityId: string;
  providerId: string;
  subcontractorProviderId?: string;
  ictServiceTypeId?: number;
  relianceLevelId?: number;
  dataSensitivityId?: number;
  startDate?: string;
  endDate?: string;
  renewalTerms?: string;
  terminationNoticePeriod?: number;
  serviceDescription?: string;
  governingLawCountry?: string;
  serviceCountry?: string;
  processingLocation?: string;
  storageLocation?: string;
  dataStorage?: boolean;
  providedByContractor?: boolean;
  providedBySubcontractor?: boolean;
  createdAt: string;

  // Included relations from backend
  financialEntity?: { id: string; name: string };
  provider?: { id: string; providerCode: string; legalName: string };
  subcontractorProvider?: { id: string; providerCode: string; legalName: string };
  ictServiceType?: { id: number; name: string };
  relianceLevel?: { id: number; levelName: string };
  dataSensitivity?: { id: number; levelName: string };
  governingLawRef?: { code: string; name: string };
  serviceCountryRef?: { code: string; name: string };
  processingRef?: { code: string; name: string };
  storageRef?: { code: string; name: string };
  ictDependencies?: any[];
}

export const contractualArrangementsApi = {
  getAll: async (): Promise<ContractualArrangement[]> => {
    const response = await apiClient.get('/contractual-arrangements');
    return response.data;
  },

  getById: async (id: string): Promise<ContractualArrangement> => {
    const response = await apiClient.get(`/contractual-arrangements/${id}`);
    return response.data;
  },

  create: async (data: Partial<ContractualArrangement>): Promise<ContractualArrangement> => {
    const response = await apiClient.post('/contractual-arrangements', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ContractualArrangement>): Promise<ContractualArrangement> => {
    const response = await apiClient.patch(`/contractual-arrangements/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/contractual-arrangements/${id}`);
  }
};
