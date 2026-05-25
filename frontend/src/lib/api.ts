import axios, { AxiosInstance } from 'axios';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: JWT anhängen ──────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('hui_admin_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: 401 → Login ──────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('hui_admin_token');
      localStorage.removeItem('hui_admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth helpers ────────────────────────────────────────────────────────────
export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hui_admin_token');
};

export const storeAuth = (token: string, user: object): void => {
  localStorage.setItem('hui_admin_token', token);
  localStorage.setItem('hui_admin_user', JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem('hui_admin_token');
  localStorage.removeItem('hui_admin_user');
};

export const getStoredUser = (): Record<string, unknown> | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('hui_admin_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
