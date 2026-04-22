import { apiClient } from './auth';

// ─── Users ───────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  role: { roleName: string | null };
}

export interface InviteUserPayload {
  email: string;
  fullName?: string;
  role: 'ADMIN' | 'ANALYST' | 'EDITOR';
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  actionType: string | null;
  tableName: string | null;
  recordId: string | null;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  createdAt: string;
  user?: { email: string; fullName: string | null } | null;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Concentration Risk ───────────────────────────────────────────────────────

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

// ─── API calls ────────────────────────────────────────────────────────────────

export const adminApi = {
  // Users
  getUsers: async (): Promise<UserRecord[]> => {
    const res = await apiClient.get('/users');
    return res.data;
  },
  inviteUser: async (payload: InviteUserPayload): Promise<{ message: string; userId: string }> => {
    const res = await apiClient.post('/users/invite', payload);
    return res.data;
  },
  updateRole: async (userId: string, role: string): Promise<UserRecord> => {
    const res = await apiClient.patch(`/users/${userId}/role`, { role });
    return res.data;
  },
  updateUser: async (userId: string, updates: { email?: string; password?: string }): Promise<UserRecord> => {
    const res = await apiClient.patch(`/users/${userId}`, updates);
    return res.data;
  },
  deactivateUser: async (userId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`/users/${userId}`);
    return res.data;
  },
  activateUser: async (userId: string): Promise<{ message: string }> => {
    const res = await apiClient.post(`/users/${userId}/activate`);
    return res.data;
  },
  deleteUser: async (userId: string): Promise<{ message: string }> => {
    const res = await apiClient.delete(`/users/${userId}/hard`);
    return res.data;
  },

  // Audit Logs
  getAuditLogs: async (params?: {
    table?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogResponse> => {
    const res = await apiClient.get('/audit-logs', { params });
    return res.data;
  },

  // Concentration Risk
  getConcentrationRisk: async (): Promise<ConcentrationRiskResponse> => {
    const res = await apiClient.get('/risk/concentration');
    return res.data;
  },
};
