import api from './api';

const AUTH_BASE = '/auth';

export const authService = {
  login: async (credentials) => {
    const response = await api.post(`${AUTH_BASE}/login`, credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post(`${AUTH_BASE}/register`, userData);
    return response.data;
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await api.post(`${AUTH_BASE}/logout`, { refreshToken });
      }
    } catch {
      // Ignored
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  },

  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');
    const response = await api.post(`${AUTH_BASE}/refresh`, { refreshToken });
    if (response.data?.accessToken) {
      localStorage.setItem('accessToken', response.data.accessToken);
    }
    if (response.data?.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get(`${AUTH_BASE}/me`);
    return response.data;
  },
};
