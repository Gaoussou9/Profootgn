// src/api/client.js
import axios from 'axios';

const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

// baseURL garanti avec un slash final
const api = axios.create({
  baseURL: base.replace(/\/+$/, '') + '/api/',
  timeout: 15000,
});

// Interceptor: 1) force des URLs relatives (retire les "/" de tête)
//              2) ajoute le Bearer token si présent
api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = config.url.replace(/^\/+/, ''); // '/matches/...' -> 'matches/...'
  }
  const t = localStorage.getItem('token');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default api;
