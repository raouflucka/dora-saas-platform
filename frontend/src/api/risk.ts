import api from './axios';

export interface ConcentrationRiskItem {
  providerId: string;
  providerName: string;
  providerLei: string | null;
  contractCount: number;
  percentageShare: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ConcentrationRiskResponse {
  totalContracts: number;
  riskItems: ConcentrationRiskItem[];
  dominantProviders: number;
  summary: string;
}

export interface GeographicRiskItem {
  countryCode: string;
  countryName: string;
  contractCount: number;
  percentageShare: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GeographicRiskResponse {
  totalContracts: number;
  riskItems: GeographicRiskItem[];
  highRiskCountries: number;
  summary: string;
}

export const riskApi = {
  getConcentration: async (): Promise<ConcentrationRiskResponse> => {
    const res = await api.get('/risk/concentration');
    return res.data;
  },
  getGeographic: async (): Promise<GeographicRiskResponse> => {
    const res = await api.get('/risk/geographic');
    return res.data;
  },
};
