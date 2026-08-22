import React from 'react';

export const StatusBar = ({ label = 'Đăng Nhập An Toàn' }) => {
  return (
    <header className="status-bar" aria-label="System status">
      <div className="led" aria-hidden="true"></div>
      <span className="status-label">{label}</span>
    </header>
  );
};
