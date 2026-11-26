import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('itam_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('itam_token');
      localStorage.removeItem('itam_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export async function downloadAuthorizedFile(urlPath: string, fallbackName: string) {
  const res = await api.get(urlPath, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = blobUrl;
  const cd = res.headers['content-disposition'];
  let fileName = fallbackName;
  if (cd) {
    const match = cd.match(/filename="?([^"]+)"?/);
    if (match) fileName = decodeURIComponent(match[1]);
  }
  a.setAttribute('download', fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
