// Shared by public settings, account settings and the persisted theme store.
// `preview` paints a miniature of each theme inside the picker. It has to be literal colours:
// the picker shows all four themes at once, so it cannot read the active theme's tokens.
// tests/theme-preview.test.mjs keeps these in step with assets/css/tokens.css.
export const THEME_OPTIONS = [
  { id: 'dark', labelKey: 'settings.theme.dark', descKey: 'settings.theme.darkDesc', swatch: 'linear-gradient(135deg, #2563EB 0%, #090A0F 100%)',
    preview: { canvas: '#090A0F', surface: '#12131C', border: '#26293A', text: '#F3F4F6', muted: '#B4C0CF', accent: '#2563EB' } },
  { id: 'light', labelKey: 'settings.theme.light', descKey: 'settings.theme.lightDesc', swatch: 'linear-gradient(135deg, #6366F1 0%, #FAFAFB 100%)',
    preview: { canvas: '#FAFAFB', surface: '#FFFFFF', border: '#E2E8F0', text: '#0F172A', muted: '#475569', accent: '#6366F1' } },
  { id: 'cream', labelKey: 'settings.theme.cream', descKey: 'settings.theme.creamDesc', swatch: 'linear-gradient(135deg, #C0531E 0%, #F5EDE0 100%)',
    preview: { canvas: '#F5EDE0', surface: '#FDF8F2', border: '#E0D4C4', text: '#2C1D10', muted: '#584133', accent: '#C0531E' } },
  { id: 'green', labelKey: 'settings.theme.green', descKey: 'settings.theme.greenDesc', swatch: 'linear-gradient(135deg, #059669 0%, #EEF8F3 100%)',
    preview: { canvas: '#F0F9F4', surface: '#FFFFFF', border: '#B2DFC8', text: '#0E2E1E', muted: '#3D6A56', accent: '#059669' } }
];
