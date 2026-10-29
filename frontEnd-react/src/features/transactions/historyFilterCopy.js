// Text for the filter chips and filter sheet on the transaction history page. Kept next to
// the (lazy-loaded) page instead of the shared dictionary so the first-load
// JavaScript budget is unaffected.
const COPY = {
  vi: {
    entriesFiltered: ({ count, total }) => `${count} / ${total} mục`, filters: 'Bộ lọc',
    activeFilters: 'Bộ lọc giao dịch',
    rangeFrom: (date) => `Từ ${date}`, rangeTo: (date) => `Đến ${date}`,
    reset: 'Đặt lại', showResults: (count) => `Xem ${count} giao dịch`
  },
  en: {
    entriesFiltered: ({ count, total }) => `${count} of ${total} entries`, filters: 'Filters',
    activeFilters: 'Transaction filters',
    rangeFrom: (date) => `From ${date}`, rangeTo: (date) => `Until ${date}`,
    reset: 'Reset', showResults: (count) => `Show ${count} result${count === 1 ? '' : 's'}`
  },
  'zh-CN': {
    entriesFiltered: ({ count, total }) => `${count} / ${total} 条记录`, filters: '筛选',
    activeFilters: '交易筛选',
    rangeFrom: (date) => `${date} 起`, rangeTo: (date) => `至 ${date}`,
    reset: '重置', showResults: (count) => `查看 ${count} 条记录`
  }
};

export const getHistoryFilterCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
