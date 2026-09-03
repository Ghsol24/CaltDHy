const getAuthToken = () => {
  try {
    return localStorage.getItem('caltdhy_token');
  } catch {
    return null;
  }
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && token && !endpoint.includes('/api/auth/login')) {
        // Token hết hạn hoặc không hợp lệ -> phát sự kiện để ứng dụng tự động đăng xuất an toàn
        window.dispatchEvent(new CustomEvent('caltdhy:auth-expired', { detail: data }));
      }
      const errorMsg = data.message || `Lỗi yêu cầu: HTTP ${res.status}`;
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (!err.status && err.message === 'Failed to fetch') {
      const offlineErr = new Error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
      offlineErr.status = 503;
      throw offlineErr;
    }
    throw err;
  }
};

export const api = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body, options = {}) =>
    apiFetch(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'DELETE' })
};
