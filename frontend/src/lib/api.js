import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProteinGoal: (protein_goal) => api.put('/auth/protein-goal', { protein_goal }),
};

// Foods
export const foodsApi = {
  search: (query, page = 1, pageSize = 25) => 
    api.get('/foods/search', { params: { query, page, page_size: pageSize } }),
  getDetails: (fdcId) => api.get(`/foods/${fdcId}`),
};

// Food Logs
export const logsApi = {
  create: (data) => api.post('/logs', data),
  getAll: (date) => api.get('/logs', { params: date ? { date } : {} }),
  delete: (logId) => api.delete(`/logs/${logId}`),
};

// Stats
export const statsApi = {
  getDaily: (date) => api.get('/stats/daily', { params: date ? { date } : {} }),
  getWeekly: () => api.get('/stats/weekly'),
};

// Meal Plans
export const mealPlansApi = {
  create: (data) => api.post('/meal-plans', data),
  getAll: () => api.get('/meal-plans'),
  delete: (planId) => api.delete(`/meal-plans/${planId}`),
};

// Favorites
export const favoritesApi = {
  add: (data) => api.post('/favorites', data),
  getAll: () => api.get('/favorites'),
  delete: (favId) => api.delete(`/favorites/${favId}`),
  check: (fdcId) => api.get(`/favorites/check/${fdcId}`),
};

export default api;
