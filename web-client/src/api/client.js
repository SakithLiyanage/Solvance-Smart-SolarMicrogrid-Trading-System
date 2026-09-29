import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('solar_auth_token');
  // Keep an explicit header (e.g. the temporary token used for the forced password change)
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 from these endpoints means wrong credentials, not an expired session
const CREDENTIAL_ENDPOINTS = ['/auth/login', '/auth/change-password'];

// Response interceptor for session expiry handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = (error.config?.url || '').toLowerCase();
    const isCredentialCheck = CREDENTIAL_ENDPOINTS.some((endpoint) => url.includes(endpoint));
    // Only a rejected token means the session expired; anonymous 401s (public pages) are not a logout
    const sentToken = Boolean(error.config?.headers?.Authorization);
    if (error.response && error.response.status === 401 && sentToken && !isCredentialCheck) {
      // Clear the dead session and tell the app to go back to the login screen
      localStorage.removeItem('solar_auth_token');
      localStorage.removeItem('solar_user_data');
      window.dispatchEvent(new Event('solvance:session-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
