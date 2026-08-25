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

  logout: () => {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  },

  getCurrentUser: async () => {
    const response = await api.get(`${AUTH_BASE}/me`);
    return response.data;
  },
};
