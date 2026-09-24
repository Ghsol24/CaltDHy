import { useCallback, useEffect } from 'react';
import { useLangStore } from '../stores/useLangStore';
import { getIntlLocale, translate, translateDataLabel } from './translations';

export function useTranslation() {
  const lang = useLangStore((state) => state.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key, values) => translate(lang, key, values), [lang]);
  const label = useCallback((value) => translateDataLabel(lang, value), [lang]);
  return { t, label, lang, intlLocale: getIntlLocale(lang) };
}
