/**
 * Auth API client — used for auth-specific calls.
 * Uses its own axios instance so auth endpoints are never caught
 * by the main api.ts 401 → refresh interceptor (prevents infinite loops).
 */
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request from this client
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// On hard auth failures (login/logout endpoints), just reject — no redirect loop
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || '';
    const isAuthEndpoint = ['/auth/login', '/auth/logout', '/auth/refresh'].some((p) =>
      url.includes(p),
    );

    if (!isAuthEndpoint && error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('userId');
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

export const authApi = {
  /**
   * Authenticates the user.
   * Stores access_token, refresh_token, and userId in localStorage via the store's setAuth.
   */
  login: async (email: string, password: string, rememberMe?: boolean) => {
    const response = await apiClient.post('/auth/login', { email, password, rememberMe });
    const { access_token, refresh_token, user } = response.data;

    // Persist tokens; authStore.setAuth also writes to localStorage
    useAuthStore.getState().setAuth(user, access_token, refresh_token);

    return response.data as { access_token: string; refresh_token: string; user: any };
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};
