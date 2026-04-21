import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// إضافة اعتراض (interceptor) لإرسال userId و role مع كل طلب
api.interceptors.request.use((config) => {
  const user = localStorage.getItem('soq_user');
  if (user) {
    const parsed = JSON.parse(user);
    config.headers['x-user-id'] = parsed.id;
    config.headers['x-user-role'] = parsed.role;
  }
  return config;
});

export default api;