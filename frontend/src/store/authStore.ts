import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'ADMIN' | 'ANALYST' | 'EDITOR';
  tenantId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  loading: true,

  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', user.id);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    set({ user, token, loading: false });
  },

  logout: async () => {
    try {
      const { authApi } = await import('../api/auth');
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('userId');
    set({ user: null, token: null, loading: false });
  },

  initializeAuth: async () => {
    set({ loading: true });
    try {
      const { authApi } = await import('../api/auth');
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
