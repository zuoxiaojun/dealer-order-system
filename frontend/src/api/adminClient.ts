import axios from 'axios'
import { useAdminStore } from '../store/adminAuth'

const adminApi = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
})

adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname === '/admin/login'
      if (!isLoginPage) {
        useAdminStore.getState().logout()
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)

export default adminApi