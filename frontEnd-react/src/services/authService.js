import { apiFetch } from './api';

export const authService = {
  login: async (credentials) => {
    return await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },

  register: async (userData) => {
    return await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  forgotPassword: async (data) => {
    return await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  resetPassword: async (data) => {
    return await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  verifyEmail: async (data) => {
    return await apiFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  resendVerification: async (email) => {
    return await apiFetch('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  getProfile: async () => {
    return await apiFetch('/api/auth/profile', {
      method: 'GET'
    });
  },

  updateProfile: async (profileData) => {
    return await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }
};
