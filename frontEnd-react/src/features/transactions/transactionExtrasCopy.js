// Text for advanced search (amount range, saved filters) in the transaction screens.
// Kept beside those lazy-loaded screens so the first-load JavaScript budget is unaffected.
const COPY = {
  vi: {
    amountRange: 'Khoảng tiền', minAmount: 'Từ', maxAmount: 'Đến',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `Từ ${min}` : `Đến ${max}`),
    amountInvalid: 'Số tiền tối thiểu đang lớn hơn tối đa.', apply: 'Áp dụng', clearAmount: 'Bỏ lọc tiền',
    savedFilters: 'Bộ lọc đã lưu', saveCurrent: 'Lưu bộ lọc hiện tại', filterName: 'Tên bộ lọc',
    filterNamePlaceholder: 'Ví dụ: Ăn ngoài tháng này', save: 'Lưu', cancel: 'Hủy', noSaved: 'Chưa có bộ lọc nào được lưu.',
    deleteFilter: (name) => `Xóa bộ lọc ${name}`, savedOk: 'Đã lưu bộ lọc.', savedFailed: 'Chưa lưu được bộ lọc. Vui lòng thử lại.',
    savedLimit: 'Chỉ lưu được tối đa 12 bộ lọc.', nothingToSave: 'Hãy chọn ít nhất một điều kiện lọc trước khi lưu.'
  },
  en: {
    amountRange: 'Amount range', minAmount: 'From', maxAmount: 'To',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `From ${min}` : `Up to ${max}`),
    amountInvalid: 'The minimum amount is above the maximum.', apply: 'Apply', clearAmount: 'Clear amount filter',
    savedFilters: 'Saved filters', saveCurrent: 'Save current filters', filterName: 'Filter name',
    filterNamePlaceholder: 'For example: Eating out this month', save: 'Save', cancel: 'Cancel', noSaved: 'No saved filters yet.',
    deleteFilter: (name) => `Delete filter ${name}`, savedOk: 'Filter saved.', savedFailed: 'The filter was not saved. Please try again.',
    savedLimit: 'You can save up to 12 filters.', nothingToSave: 'Choose at least one filter before saving.'
  },
  'zh-CN': {
    amountRange: '金额范围', minAmount: '最低', maxAmount: '最高',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `${min} 起` : `至 ${max}`),
    amountInvalid: '最低金额高于最高金额。', apply: '应用', clearAmount: '清除金额筛选',
    savedFilters: '已保存的筛选', saveCurrent: '保存当前筛选', filterName: '筛选名称',
    filterNamePlaceholder: '例如：本月外出就餐', save: '保存', cancel: '取消', noSaved: '还没有已保存的筛选。',
    deleteFilter: (name) => `删除筛选 ${name}`, savedOk: '筛选已保存。', savedFailed: '筛选未能保存，请重试。',
    savedLimit: '最多可保存 12 个筛选。', nothingToSave: '保存前请至少选择一个筛选条件。'
  }
};
export const getTransactionExtrasCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
