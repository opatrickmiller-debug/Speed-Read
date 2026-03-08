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
  updateSettings: (data) => api.put('/auth/settings', data),
  calculateProteinGoal: () => api.get('/auth/calculate-protein-goal'),
};

// Foods
export const foodsApi = {
  search: (query, includeBranded = false, page = 1, pageSize = 25) => 
    api.get('/foods/search', { params: { query, page, page_size: pageSize, include_branded: includeBranded } }),
  getDetails: (fdcId) => api.get(`/foods/${fdcId}`),
};

// Keto Score
export const ketoApi = {
  getScore: (date) => api.get('/keto-score', { params: date ? { date } : {} }),
};

// Nutrition Score
export const nutritionApi = {
  getScore: (date) => api.get('/nutrition-score', { params: date ? { date } : {} }),
};

// Custom Meals
export const customMealsApi = {
  create: (data) => api.post('/custom-meals', data),
  getAll: () => api.get('/custom-meals'),
  delete: (mealId) => api.delete(`/custom-meals/${mealId}`),
  log: (mealId, mealType = 'snack') => 
    api.post(`/custom-meals/${mealId}/log`, null, { params: { meal_type: mealType } }),
};

// Food Logs
export const logsApi = {
  create: (data) => api.post('/logs', data),
  quickLog: (foodId, amount, meal) => api.post('/logs/quick', { food_id: foodId, amount, meal }),
  // Log by serving selection (MyFitnessPal style)
  logByServing: (foodId, amount, servingIndex, meal) => 
    api.post('/logs/serving', { food_id: foodId, amount, serving_index: servingIndex, meal }),
  getAll: (date) => api.get('/logs', { params: date ? { date } : {} }),
  delete: (logId) => api.delete(`/logs/${logId}`),
};

// Stats
export const statsApi = {
  getDaily: (date) => api.get('/stats/daily', { params: date ? { date } : {} }),
  getWeekly: () => api.get('/stats/weekly'),
};

// Suggestions
export const suggestionsApi = {
  getAminoAcids: (date) => api.get('/suggestions/amino-acids', { params: date ? { date } : {} }),
  getFattyAcids: (date) => api.get('/suggestions/fatty-acids', { params: date ? { date } : {} }),
  getOmegaRichFoods: (omegaType = 3) => api.get('/suggestions/omega-rich-foods', { params: { omega_type: omegaType } }),
  getCompleteProteins: () => api.get('/suggestions/complete-protein'),
  getKetoMeals: () => api.get('/suggestions/keto-meals'),
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

// Custom Foods
export const customFoodsApi = {
  create: (data) => api.post('/custom-foods', data),
  getAll: () => api.get('/custom-foods'),
  get: (foodId) => api.get(`/custom-foods/${foodId}`),
  update: (foodId, data) => api.put(`/custom-foods/${foodId}`, data),
  delete: (foodId) => api.delete(`/custom-foods/${foodId}`),
};

// Popularity tracking
export const popularityApi = {
  trackSelection: (foodId, description, source = 'usda') => 
    api.post(`/popularity/track-selection?food_id=${foodId}&description=${encodeURIComponent(description)}&source=${source}`),
  getTopFoods: (limit = 20) => api.get(`/popularity/top-foods?limit=${limit}`),
};

export default api;
