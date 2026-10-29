// Pure date helpers for CustomDatePicker (kept free of React so they can be unit tested).
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (value) => String(value).padStart(2, '0');
const toIso = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

export function isoFromParts(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
  if (year < 1900 || year > 2999) return null;
  return toIso(year, monthIndex, day);
}

export function parseIsoDate(value) {
  const match = ISO_DATE.exec(value || '');
  if (!match) return null;
  const iso = isoFromParts(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return iso ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

/** Accepts dd/mm/yyyy, d-m-yyyy, ddmmyyyy and yyyy-mm-dd. Returns ISO, '' for empty, null if invalid. */
export function parseTypedDate(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  match = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return null;
}

export function formatDisplayDate(iso, order = 'dmy') {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const dd = pad(parts.day);
  const mm = pad(parts.month + 1);
  return order === 'ymd' ? `${parts.year}/${mm}/${dd}` : `${dd}/${mm}/${parts.year}`;
}

