// Strings used only by the analytics screen (loaded on demand). Registered here, not in
// translations.js, so they stay out of the initial bundle; AnalyticsView imports this file.
import { registerTranslations } from './translations';

registerTranslations({
  vi: {
    'change.times': 'gấp {count} lần',
    'analytics.cashflow.expenseExcludingRecurring': 'Chi tiêu (không gồm định kỳ)',
    'analytics.unusualMarkExpectedHint': 'Không cảnh báo ngày này nữa',
  },
  en: {
    'change.times': '{count}× higher',
    'analytics.cashflow.expenseExcludingRecurring': 'Expenses (excluding recurring)',
    'analytics.unusualMarkExpectedHint': 'Stop flagging this day',
  },
  'zh-CN': {
    'change.times': '{count} 倍',
    'analytics.cashflow.expenseExcludingRecurring': '支出（不含定期款项）',
    'analytics.unusualMarkExpectedHint': '不再提醒这一天',
  },
});
