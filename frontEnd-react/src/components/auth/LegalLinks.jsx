import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from '../../i18n/useTranslation';

const COPY = {
  vi: { lead: 'Bằng việc tiếp tục, bạn đồng ý với', terms: 'Điều khoản sử dụng', and: 'và', privacy: 'Chính sách quyền riêng tư' },
  en: { lead: 'By continuing, you agree to the', terms: 'Terms of Service', and: 'and', privacy: 'Privacy Policy' },
};

// Dòng đồng ý điều khoản ở các trang đăng nhập / đăng ký (zh-CN dùng bản en).
export function LegalLinks() {
  const { lang } = useTranslation();
  const c = COPY[lang] || COPY.en;
  return (
    <p className="mod-footer legal-links">
      {c.lead} <Link to="/terms" className="lnk">{c.terms}</Link> {c.and} <Link to="/privacy" className="lnk">{c.privacy}</Link>.
    </p>
  );
}
