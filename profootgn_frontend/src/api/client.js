import axios from 'axios'
const base = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
const api = axios.create({ baseURL: base.replace(/\/$/, '') + '/api', timeout: 15000 })
api.interceptors.request.use((config) => {
  const t = localStorage.getItem('token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})
export default api