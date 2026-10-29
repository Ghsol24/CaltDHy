// Text for the active-filter chips on the transaction history page. Kept next to
// the (lazy-loaded) page instead of the shared dictionary so the first-load
// JavaScript budget is unaffected.
const COPY = {
  vi: {
    entriesFiltered: ({ count, total }) => `${count} / ${total} mục`, filters: 'Bộ lọc',
    activeFilters: 'Bộ lọc đang áp dụng', removeFilter: (name) => `Bỏ bộ lọc ${name}`,
    clearAll: 'Xóa tất cả', searchChip: (query) => `Tìm: “${query}”`,
    rangeFrom: (date) => `Từ ${date}`, rangeTo: (date) => `Đến ${date}`
  },
  en: {
    entriesFiltered: ({ count, total }) => `${count} of ${total} entries`, filters: 'Filters',
    activeFilters: 'Active filters', removeFilter: (name) => `Remove filter ${name}`,
    clearAll: 'Clear all', searchChip: (query) => `Search: “${query}”`,
    rangeFrom: (date) => `From ${date}`, rangeTo: (date) => `Until ${date}`
  },
  'zh-CN': {
    entriesFiltered: ({ count, total }) => `${count} / ${total} 条记录`, filters: '筛选',
    activeFilters: '已应用的筛选', removeFilter: (name) => `移除筛选：${name}`,
    clearAll: '全部清除', searchChip: (query) => `搜索：“${query}”`,
    rangeFrom: (date) => `${date} 起`, rangeTo: (date) => `至 ${date}`
  }
};

export const getHistoryFilterCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
