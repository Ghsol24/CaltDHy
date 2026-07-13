/* ============================================================
   CaltDHy — services/api.js
   Centralized API layer: handles all HTTP calls to the backend.
   Falls back to localStorage when offline.
   ============================================================ */

const BASE_URL = '/api';

// ── Lấy token từ localStorage ──
function getToken() {
  return localStorage.getItem('caltdhy_token');
}

// ── Header chuẩn có Authorization ──
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

// ── Wrapper fetch chung ──
async function request(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: authHeaders(),
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API Error');
  return data;
}

/* ─────────────── AUTH ─────────────── */

export async function apiLogin(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) localStorage.setItem('caltdhy_token', data.token);
  return data;
}

export async function apiRegister(name, email, password) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (data.token) localStorage.setItem('caltdhy_token', data.token);
  return data;
}

export async function apiForgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function apiGetProfile() {
  return request('/auth/profile');
}

export async function apiUpdateProfile(payload) {
  return request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function apiLogout() {
  localStorage.removeItem('caltdhy_token');
}

/* ─────────────── TRANSACTIONS ─────────────── */

export async function apiGetTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/spending${query ? '?' + query : ''}`);
}

export async function apiAddTransaction(payload) {
  return request('/spending', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateTransaction(id, payload) {
  return request(`/spending/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiDeleteTransaction(id) {
  return request(`/spending/${id}`, { method: 'DELETE' });
}

/* ─────────────── BUDGETS & CATEGORIES ─────────────── */

export async function apiGetBudgets() {
  return request('/spending/budget');
}

export async function apiUpdateBudgets(payload) {
  return request('/spending/budget', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function apiGetCustomCategories() {
  return request('/spending/categories');
}

export async function apiUpdateCustomCategories(categories) {
  return request('/spending/categories', {
    method: 'PUT',
    body: JSON.stringify({ categories }),
  });
}


/* ─────────────── JARS ─────────────── */

export async function apiGetJars() {
  return request('/jars');
}

export async function apiSaveJars(jars) {
  return request('/jars', {
    method: 'POST',
    body: JSON.stringify({ jars }),
  });
}

/* ─────────────── HEALTH CHECK ─────────────── */

export async function apiHealthCheck() {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
