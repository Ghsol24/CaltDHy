import React from 'react';
import { LockOutlineIcon } from './AppIcons';

export const StatusBar = ({ label = 'Đăng Nhập An Toàn' }) => {
  return (
    <header className="status-bar">
      <LockOutlineIcon size={14} aria-hidden="true" />
      <span className="status-label">{label}</span>
    </header>
  );
};
