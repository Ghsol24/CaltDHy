/* ============================================================
   CaltDHy — hooks/useAuth.js
   Custom hook quản lý trạng thái xác thực người dùng.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiLogin, apiRegister, apiLogout, apiGetProfile } from '../services/api';

/**
 * Decode JWT payload (base64) — chỉ để đọc thông tin, không verify crypto.
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    // Sử dụng decodeURIComponent(escape(atob(...))) để giải mã UTF-8 đúng cách tránh lỗi font (Mojibake)
    const binStr = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(binStr)));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now();
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Khởi tạo: đọc token từ localStorage khi app load ──
  useEffect(() => {
    const token = localStorage.getItem('caltdhy_token');
    if (token && !isTokenExpired(token)) {
      const decoded = decodeToken(token);
      setUser({ id: decoded.id, name: decoded.name, email: decoded.email });
    } else {
      localStorage.removeItem('caltdhy_token');
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    const decoded = decodeToken(data.token);
    const userData = { id: decoded.id, name: decoded.name, email: decoded.email };
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await apiRegister(name, email, password);
    const decoded = decodeToken(data.token);
    const userData = { id: decoded.id, name: decoded.name, email: decoded.email };
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  return { user, loading, login, register, logout, updateUser };
}
