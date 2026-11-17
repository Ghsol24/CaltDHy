// Text for the filter chips and filter sheet on the transaction history page. Kept next to
// the (lazy-loaded) page instead of the shared dictionary so the first-load
// JavaScript budget is unaffected.
const COPY = {
  vi: {
    entriesFiltered: ({ count, total }) => `${count} / ${total} mục`, filters: 'Bộ lọc',
    activeFilters: 'Bộ lọc giao dịch',
    rangeFrom: (date) => `Từ ${date}`, rangeTo: (date) => `Đến ${date}`,
    reset: 'Đặt lại', showResults: (count) => `Xem ${count} giao dịch`,
    income: 'Thu', expense: 'Chi', difference: 'Chênh lệch', appliedFilters: 'Bộ lọc đang áp dụng',
    chipCategory: (name) => `Danh mục: ${name}`, chipWallet: (name) => `Ví: ${name}`,
    removeFilter: (name) => `Bỏ lọc ${name}`
  },
  en: {
    entriesFiltered: ({ count, total }) => `${count} of ${total} entries`, filters: 'Filters',
    activeFilters: 'Transaction filters',
    rangeFrom: (date) => `From ${date}`, rangeTo: (date) => `Until ${date}`,
    reset: 'Reset', showResults: (count) => `Show ${count} result${count === 1 ? '' : 's'}`,
    income: 'Income', expense: 'Spent', difference: 'Difference', appliedFilters: 'Applied filters',
    chipCategory: (name) => `Category: ${name}`, chipWallet: (name) => `Wallet: ${name}`,
    removeFilter: (name) => `Remove filter ${name}`
  },
  'zh-CN': {
    entriesFiltered: ({ count, total }) => `${count} / ${total} 条记录`, filters: '筛选',
    activeFilters: '交易筛选',
    rangeFrom: (date) => `${date} 起`, rangeTo: (date) => `至 ${date}`,
    reset: '重置', showResults: (count) => `查看 ${count} 条记录`,
    income: '收入', expense: '支出', difference: '差额', appliedFilters: '已应用的筛选',
    chipCategory: (name) => `类别：${name}`, chipWallet: (name) => `钱包：${name}`,
    removeFilter: (name) => `移除筛选 ${name}`
  }
};

export const getHistoryFilterCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
