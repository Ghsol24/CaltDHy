import React from 'react';
import { Link, useLocation } from 'react-router';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { useTranslation } from '../i18n/useTranslation';
import { CONTACT_EMAIL, LEGAL_COPY } from './legalCopy';
import './auth.css';

// Trang công khai (không cần đăng nhập): /privacy và /terms. Bản zh-CN dùng tạm bản tiếng Anh.
export function LegalPage() {
  const { lang } = useTranslation();
  const { pathname } = useLocation();
  const copy = LEGAL_COPY[lang] || LEGAL_COPY.en;
  const kind = pathname.startsWith('/terms') ? 'terms' : 'privacy';
  const doc = copy[kind];
  const other = kind === 'terms' ? '/privacy' : '/terms';

  return (
    <div className="auth-page legal-page">
      <main>
        <IndustrialPanel title={doc.title} titleHighlight={doc.highlight} className="legal-doc">
          <p className="legal-meta">{copy.updatedLabel}: {doc.updated}</p>
          <p>{doc.intro}</p>
          {doc.sections.map((section) => (
            <section key={section.h}>
              <h2>{section.h}</h2>
              {section.list && <ul>{section.list.map((item) => <li key={item}>{item}</li>)}</ul>}
              {section.p && section.p.map((text) => <p key={text}>{text}</p>)}
            </section>
          ))}
          {CONTACT_EMAIL && (
            <section>
              <h2>{copy.contactLabel}</h2>
              <p><a className="lnk" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            </section>
          )}
          <p className="mod-footer">
            <Link to="/login" className="lnk">{copy.back}</Link>{' · '}
            <Link to={other} className="lnk">{copy.otherDoc[kind]}</Link>
          </p>
        </IndustrialPanel>
      </main>
    </div>
  );
}
