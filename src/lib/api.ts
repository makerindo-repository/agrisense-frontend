import axios from 'axios';

// Instance axios dengan timeout 15 detik
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Tambahkan token dari localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agrisense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 tanpa full page reload
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        const url = error.config?.url || '';
        if (!url.includes('/auth/google') && !url.includes('/login')) {
          localStorage.removeItem('agrisense_token');
          localStorage.removeItem('agrisense_user');
          // Dispatch event agar App.tsx bisa handle
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }

      if (error.response.data && error.response.data.message === 'The given data was invalid.') {
        error.response.data.message = 'Data yang Anda masukkan tidak valid atau belum lengkap.';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
