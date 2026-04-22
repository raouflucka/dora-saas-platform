import api from './axios';

export interface Country {
  code: string;
  name: string;
}

export interface Currency {
  code: string;
  name: string | null;
}

export const referenceApi = {
  getCountries: async (): Promise<Country[]> => {
    const response = await api.get('/reference/countries');
    return response.data;
  },
  getCurrencies: async (): Promise<Currency[]> => {
    const response = await api.get('/reference/currencies');
    return response.data;
  },
  getIctServiceTypes: async () => {
    const response = await api.get('/reference/ict-service-types');
    return response.data;
  },
  getRelianceLevels: async () => {
    const response = await api.get('/reference/reliance-levels');
    return response.data;
  },
  getDataSensitivityLevels: async () => {
    const response = await api.get('/reference/data-sensitivity-levels');
    return response.data;
  },
  getCriticalityLevels: async (): Promise<{ id: number; levelName: string }[]> => {
    const response = await api.get('/reference/criticality-levels');
    return response.data;
  },
  getEntityTypes: async (): Promise<{ id: number; name: string }[]> => {
    const response = await api.get('/reference/entity-types');
    return response.data;
  },
  getProviderPersonTypes: async (): Promise<{ id: number; personType?: string; name?: string }[]> => {
    const response = await api.get('/reference/provider-person-types');
    return response.data;
  },
};
