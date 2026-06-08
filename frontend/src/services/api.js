import axios from 'axios';

const RENDER_API_BASE = 'https://wplanner-j7a7.onrender.com/api';
const RENDER_API_ORIGIN = 'https://wplanner-j7a7.onrender.com';

export const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_API_BASE_URL || '').replace(/\/api\/?$/, '') ||
  RENDER_API_ORIGIN;

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || RENDER_API_BASE;

/** Build a full URL for fetch() or static asset paths (e.g. /api/..., /uploads/...). */
export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${normalized}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
