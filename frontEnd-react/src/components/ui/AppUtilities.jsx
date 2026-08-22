import React, { useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';

function Overlay({ title, onClose, children }) {
  return <div className="modal-overlay open" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.7)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title} style={{ width: 'min(480px, 100%)', padding: 24, background: 'var(--panel)', borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><button className="btn-ghost" onClick={onClose}>✕</button></div>
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  </div>;
}

export function AppUtilities() {
  const spending = useSpendingStore();
  const { theme, setTheme } = useThemeStore();
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');

  const saveProfile = async (event) => {
    event.preventDefault();
    try { await updateProfile({ name, email }); setMessage('Đã lưu tài khoản. Nếu đổi email, hãy xác minh địa chỉ mới.'); }
    catch (error) { setMessage(error.message || 'Không thể cập nhật tài khoản.'); }
  };

  return <>
    {spending.isSettingsOpen && <Overlay title="Cài đặt" onClose={spending.closeSettingsModal}>
      <p style={{ color: 'var(--muted)' }}>Giao diện</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['dark', 'light', 'cream', 'green'].map((item) => <button key={item} className="btn-ghost" style={{ outline: theme === item ? '2px solid var(--accent)' : 'none' }} onClick={() => setTheme(item)}>{item.toUpperCase()}</button>)}</div>
    </Overlay>}
    {spending.isAccountOpen && <Overlay title="Tài khoản" onClose={spending.closeAccountModal}>
      <form onSubmit={saveProfile} style={{ display: 'grid', gap: 12 }}><input className="finput" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên hiển thị" required /><input className="finput" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required /><button className="btn-cta" type="submit">LƯU THAY ĐỔI</button>{message && <p role="status" style={{ color: 'var(--muted)', margin: 0 }}>{message}</p>}</form>
    </Overlay>}
    {spending.isHelpOpen && <Overlay title="Hướng dẫn nhanh" onClose={spending.closeHelpModal}><ol style={{ color: 'var(--muted)', lineHeight: 1.8, paddingLeft: 20 }}><li>Thêm thu hoặc chi từ nút ADD TRANSACTION.</li><li>Mở ANALYTICS để quản lý ngân sách tháng.</li><li>Mở JARS để tạo mục tiêu tiết kiệm và khoản định kỳ.</li></ol></Overlay>}
    {spending.isWrapupOpen && <Overlay title="Tổng kết" onClose={spending.closeWrapupModal}><p style={{ color: 'var(--muted)' }}>Báo cáo theo tháng có trong tab ANALYTICS. Lịch sử giao dịch hiển thị ở Dashboard.</p></Overlay>}
  </>;
}
