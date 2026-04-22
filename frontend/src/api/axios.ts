/**
 * Axios instance with automatic access-token refresh.
 *
 * Flow:
 *  1. Every request attaches the access_token from localStorage.
 *  2. On 401 (token expired) the response interceptor calls POST /auth/refresh.
 *  3. If refresh succeeds, both tokens are rotated in localStorage and the
 *     original request is retried transparently with the new access token.
 *  4. If refresh fails (refresh token also expired or invalid), the user is
 *     forced back to /login and both tokens are cleared.
 *
 * The refresh token is sent in the request body alongside the userId because
 * the HttpOnly cookie is scoped to /api/v1/auth and NestJS reads it from
 * req.cookies on the refresh endpoint.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send cookies on all requests
});

// ── Request interceptor — attach access token from localStorage ──────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request until the new token arrives
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retried = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const userId       = localStorage.getItem('userId');

      if (!refreshToken || !userId) {
        throw new Error('No refresh credentials available.');
      }

      // Call the refresh endpoint — also sends the HttpOnly cookie automatically
      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh`,
        { userId, refresh_token: refreshToken },
        { withCredentials: true },
      );

      const newAccessToken  = data.access_token;
      const newRefreshToken = data.refresh_token;

      // Persist rotated tokens
      localStorage.setItem('token',         newAccessToken);
      localStorage.setItem('refresh_token', newRefreshToken);

      // Update authorization header for the queued + original requests
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);

      // Retry the original failed request
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh failed — clear all credentials and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('userId');
      // Clear Zustand auth store if it exists
      try {
        const { useAuthStore } = await import('../store/authStore');
        useAuthStore.getState().logout();
      } catch { /* store not yet initialised */ }

      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
