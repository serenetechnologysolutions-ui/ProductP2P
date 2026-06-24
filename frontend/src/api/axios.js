import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vendor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only force a redirect for a session that *was* authenticated and got
    // invalidated — not for a 401 from the login attempt itself, which is just
    // "wrong password" and needs to show inline on the login form, not wipe it
    // out from under the user via a hard navigation.
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
