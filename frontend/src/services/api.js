import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data) => api.post('auth/login/', data),
  register: (data) => api.post('auth/register/', data),
  refresh: () => api.post('auth/refresh/')
};

export const mediaAPI = {
  getFiles: () => api.get('media/'),
  uploadFile: (file) => api.post('media/upload/', file),
  archiveFile: (id) => api.post(`media/archive/${id}/`),
  restoreFile: (id) => api.post(`media/restore/${id}/`)
};

export const jobAPI = {
  getJobs: () => api.get('jobs/'),
  getJobStats: () => api.get('jobs/stats/')
};

export const s3ConfigAPI = {
  getConfig: () => api.get('s3/config/'),
  saveConfig: (data) => api.post('s3/config/', data)
};