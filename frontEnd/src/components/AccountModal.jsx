/* ============================================================
   CaltDHy — components/AccountModal.jsx
   Modal quản lý tài khoản, thay đổi avatar, tên, email, mật khẩu.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { apiUpdateProfile } from '../services/api';

export default function AccountModal({ isOpen, onClose, user, updateUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatar(user.avatar || '');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Lấy chữ cái viết tắt đại diện
  const getInitials = (fullName) => {
    if (!fullName) return 'US';
    return fullName
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const handleAvatarChange = (e) => {
    setError('');
    setSuccess('');
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit: 1MB
    if (file.size > 1024 * 1024) {
      setError('Dung lượng ảnh vượt quá 1MB. Vui lòng chọn ảnh khác nhẹ hơn.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Tệp đã chọn không phải định dạng hình ảnh hợp lệ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim()) {
      return setError('Vui lòng nhập đầy đủ tên và email.');
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        avatar,
        currentPassword,
        newPassword,
      };

      const res = await apiUpdateProfile(payload);
      if (res.success) {
        // Cập nhật token và user vào localStorage
        localStorage.setItem('caltdhy_token', res.token);
        
        // Gọi callback cập nhật State của App
        updateUser(res.user);

        setSuccess('Cập nhật tài khoản thành công!');
        setTimeout(() => {
          onClose();
          setCurrentPassword('');
          setNewPassword('');
        }, 1000);
      } else {
        setError(res.message || 'Cập nhật thất bại. Vui lòng kiểm tra lại.');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi cập nhật tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="account-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card modal-card--account">
        <button className="modal-close" onClick={onClose} aria-label="Close profile">✕</button>

        <div className="modal-card__screw mc--tl" aria-hidden="true"></div>
        <div className="modal-card__screw mc--tr" aria-hidden="true"></div>
        <div className="modal-card__screw mc--bl" aria-hidden="true"></div>
        <div className="modal-card__screw mc--br" aria-hidden="true"></div>

        <h2 className="modal-title" id="account-title">QUẢN LÝ TÀI KHOẢN</h2>

        <div className="modal-vents" aria-hidden="true">
          <div className="modal-vent"></div>
          <div className="modal-vent"></div>
          <div className="modal-vent"></div>
          <div className="modal-vent"></div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Avatar Section */}
          <div className="account-avatar-section">
            <div
              className="account-avatar-wrapper"
              id="accountAvatarPreview"
              style={{ backgroundImage: avatar ? `url(${avatar})` : 'none', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              data-hover-label="ĐỔI ẢNH"
            >
              {!avatar && (
                <span className="account-avatar-placeholder" id="accountAvatarPlaceholder">
                  {getInitials(name)}
                </span>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              hidden
              onChange={handleAvatarChange}
            />
            <p className="account-avatar-hint">Nhấp để tải ảnh đại diện từ thiết bị lên (Tối đa 1MB)</p>
          </div>

          {/* Alert messages */}
          {error && <div className="account-alert alert--error" role="alert" style={{ display: 'block' }}>{error}</div>}
          {success && <div className="account-alert alert--success" role="alert" style={{ display: 'block' }}>{success}</div>}

          {/* Input Groups */}
          <div className="form-group">
            <label className="form-label" htmlFor="accountName">Tên hiển thị</label>
            <input
              className="form-input"
              id="accountName"
              type="text"
              placeholder="Tên của bạn"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="accountEmail">Email</label>
            <input
              className="form-input"
              id="accountEmail"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-divider-label" style={{ margin: '15px 0 10px', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.05em' }}>
            Đổi mật khẩu (Để trống nếu không đổi)
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="accountCurrentPassword">Mật khẩu hiện tại</label>
            <input
              className="form-input"
              id="accountCurrentPassword"
              type="password"
              placeholder="••••••"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="accountNewPassword">Mật khẩu mới</label>
            <input
              className="form-input"
              id="accountNewPassword"
              type="password"
              placeholder="••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button className="btn-cancel" type="button" onClick={onClose}>HỦY</button>
            <button className="btn-save" type="submit" disabled={loading}>
              {loading ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
