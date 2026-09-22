/**
 * Axios instance for the Analytics Platform API.
 *
 * Request interceptor:  attaches JWT Bearer token from localStorage.
 * Response interceptor: on 401, tries silent token refresh once.
 *                       If refresh also fails, clears storage and redirects to /login.
 */
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { APP_CONFIG } from '@config/app.config';

const apiClient: AxiosInstance = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 30_000,
});

// ── Attach token to every request ─────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(APP_CONFIG.tokenKey);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Silent token refresh on 401 ───────────────────────────────────────────────
let isRefreshing = false;
let waitQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

function flushQueue(err: unknown, token: string | null = null) {
  waitQueue.forEach(p => (err ? p.reject(err) : p.resolve(token)));
  waitQueue = [];
}

function clearSession() {
  localStorage.removeItem(APP_CONFIG.tokenKey);
  localStorage.removeItem(APP_CONFIG.refreshTokenKey);
  // Only redirect if not already on the login page
  if (!window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/change-password')) {
    window.location.href = '/login';
  }
}

apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error) => {
    const original = error.config;

    // Only retry on 401, and not for auth endpoints themselves
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          waitQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem(APP_CONFIG.refreshTokenKey);

      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${APP_CONFIG.apiBaseUrl}/auth/refresh`,
          { refresh_token: refreshToken },
        );
        localStorage.setItem(APP_CONFIG.tokenKey, data.access_token);
        localStorage.setItem(APP_CONFIG.refreshTokenKey, data.refresh_token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        flushQueue(null, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        clearSession();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
