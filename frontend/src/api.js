import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('tf_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const auth = {
  signup: (data) => api.post('/auth/signup', data).then(r => r.data),
  login: (data) => api.post('/auth/login', data).then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
}

export const tasks = {
  list: (params) => api.get('/tasks', { params }).then(r => r.data),
  create: (data) => api.post('/tasks', data).then(r => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/tasks/${id}`).then(r => r.data),
  stats: () => api.get('/tasks/stats').then(r => r.data),
}

export default api