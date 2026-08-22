import { create } from 'zustand';
import { authService } from '../services/authService';

const TOKEN_KEY = 'caltdhy_token';
const USER_KEY = 'caltdhy_user';

const getStoredToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
};

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await authService.login({ email, password });
      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        set({
          token: data.token,
          user: data.user,
          isAuthenticated: true,
          isLoading: false
        });
        return { success: true, user: data.user };
      } else {
        throw new Error(data.message || 'Đăng nhập thất bại.');
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const data = await authService.register({ name, email, password });
      if (!data.success) {
        throw new Error(data.message || 'Đăng ký thất bại.');
      }
      set({ isLoading: false });
      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    const keysToRemove = [
      TOKEN_KEY,
      USER_KEY,
      'caltdhy_txns',
      'caltdhy_budgets',
      'caltdhy_custom_cats',
      'caltdhy_hidden_cats',
      'caltdhy_last_reported_month',
      'caltdhy_is_new_user'
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  updateProfile: async (profileData) => {
    set({ isLoading: true });
    try {
      const data = await authService.updateProfile(profileData);
      if (data.success) {
        const updatedUser = data.user || { ...get().user, name: profileData.name };
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
        }
        set({
          user: updatedUser,
          token: data.token || get().token,
          isLoading: false
        });
        return { success: true, user: updatedUser };
      } else {
        throw new Error(data.message || 'Cập nhật tài khoản thất bại.');
      }
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  }
}));
