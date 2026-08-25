import { useLangStore } from '../stores/useLangStore';
import { translations } from './translations';

export function useTranslation() {
  const lang = useLangStore((s) => s.lang);
  const t = (key) => translations[lang]?.[key] ?? translations.vi?.[key] ?? translations.en?.[key] ?? key;
  return { t, lang };
}
