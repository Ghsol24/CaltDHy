// Text for tags, long notes, receipt photos, split bills, advanced search and saved filters.
// Kept beside the lazy-loaded transaction screens so the first-load JavaScript budget is unaffected.
const COPY = {
  vi: {
    details: 'Nhãn, ghi chú dài và ảnh hóa đơn', tags: 'Nhãn', tagsPlaceholder: 'Gõ nhãn rồi nhấn Enter',
    tagsHint: (max) => `Tối đa ${max} nhãn, mỗi nhãn 30 ký tự.`, removeTag: (tag) => `Bỏ nhãn ${tag}`,
    longNote: 'Ghi chú chi tiết', longNotePlaceholder: 'Ví dụ: đi cùng ai, bảo hành đến khi nào…',
    receipts: 'Ảnh hóa đơn', addReceipt: 'Thêm ảnh', receiptsHint: 'Tối đa 3 ảnh. Ảnh được thu nhỏ trước khi lưu.',
    receiptInvalid: 'Không đọc được ảnh này. Hãy chọn ảnh JPEG, PNG hoặc WebP.',
    receiptFailed: 'Chưa lưu được ảnh. Vui lòng thử lại.', receiptsPartial: 'Đã lưu giao dịch nhưng có ảnh chưa tải lên được. Mở lại giao dịch để thêm ảnh.',
    removeReceipt: 'Xóa ảnh', viewReceipt: 'Xem ảnh hóa đơn', receiptLoading: 'Đang tải ảnh…', closeReceipt: 'Đóng ảnh',
    split: 'Chia hóa đơn thành nhiều danh mục', splitHint: 'Số tiền ở trên là tổng hóa đơn. Phần chưa chia thuộc danh mục đã chọn.',
    splitPart: (index) => `Phần ${index}`, splitCategory: 'Danh mục', splitAmount: 'Số tiền', splitAdd: 'Thêm phần',
    splitRemove: 'Bỏ phần này', splitRemainder: (category, amount) => `Còn lại cho ${category}: ${amount}`,
    splitOver: 'Các phần đã chia vượt quá tổng hóa đơn.', splitIncomplete: 'Mỗi phần cần danh mục và số tiền lớn hơn 0.',
    splitDuplicate: 'Mỗi danh mục chỉ nên xuất hiện một lần.',
    splitSaved: (count, amount) => `Đã lưu hóa đơn ${amount} thành ${count} phần.`, splitBadge: 'Hóa đơn chia',
    splitEditHint: 'Giao dịch này là một phần của hóa đơn chia. Sửa ở đây chỉ đổi phần này.',
    filterTag: 'Nhãn', allTags: 'Mọi nhãn', amountRange: 'Khoảng tiền', minAmount: 'Từ', maxAmount: 'Đến',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `Từ ${min}` : `Đến ${max}`),
    amountInvalid: 'Số tiền tối thiểu đang lớn hơn tối đa.', apply: 'Áp dụng', clearAmount: 'Bỏ lọc tiền',
    savedFilters: 'Bộ lọc đã lưu', saveCurrent: 'Lưu bộ lọc hiện tại', filterName: 'Tên bộ lọc',
    filterNamePlaceholder: 'Ví dụ: Ăn ngoài tháng này', save: 'Lưu', cancel: 'Hủy', noSaved: 'Chưa có bộ lọc nào được lưu.',
    deleteFilter: (name) => `Xóa bộ lọc ${name}`, savedOk: 'Đã lưu bộ lọc.', savedFailed: 'Chưa lưu được bộ lọc. Vui lòng thử lại.',
    savedLimit: 'Chỉ lưu được tối đa 12 bộ lọc.', nothingToSave: 'Hãy chọn ít nhất một điều kiện lọc trước khi lưu.',
    hasNote: 'Có ghi chú chi tiết'
  },
  en: {
    details: 'Tags, long note and receipt photos', tags: 'Tags', tagsPlaceholder: 'Type a tag and press Enter',
    tagsHint: (max) => `Up to ${max} tags, 30 characters each.`, removeTag: (tag) => `Remove tag ${tag}`,
    longNote: 'Detailed note', longNotePlaceholder: 'For example: who you were with, warranty end date…',
    receipts: 'Receipt photos', addReceipt: 'Add photo', receiptsHint: 'Up to 3 photos. Photos are resized before saving.',
    receiptInvalid: 'This image could not be read. Choose a JPEG, PNG or WebP image.',
    receiptFailed: 'The photo was not saved. Please try again.', receiptsPartial: 'The transaction was saved, but a photo failed to upload. Reopen it to add the photo.',
    removeReceipt: 'Delete photo', viewReceipt: 'View receipt photo', receiptLoading: 'Loading photo…', closeReceipt: 'Close photo',
    split: 'Split this bill across categories', splitHint: 'The amount above is the bill total. Whatever is not split stays in the chosen category.',
    splitPart: (index) => `Part ${index}`, splitCategory: 'Category', splitAmount: 'Amount', splitAdd: 'Add part',
    splitRemove: 'Remove this part', splitRemainder: (category, amount) => `Left for ${category}: ${amount}`,
    splitOver: 'The parts add up to more than the bill total.', splitIncomplete: 'Each part needs a category and an amount above 0.',
    splitDuplicate: 'Each category should appear only once.',
    splitSaved: (count, amount) => `Saved the ${amount} bill as ${count} parts.`, splitBadge: 'Split bill',
    splitEditHint: 'This entry is one part of a split bill. Editing here changes this part only.',
    filterTag: 'Tag', allTags: 'All tags', amountRange: 'Amount range', minAmount: 'From', maxAmount: 'To',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `From ${min}` : `Up to ${max}`),
    amountInvalid: 'The minimum amount is above the maximum.', apply: 'Apply', clearAmount: 'Clear amount filter',
    savedFilters: 'Saved filters', saveCurrent: 'Save current filters', filterName: 'Filter name',
    filterNamePlaceholder: 'For example: Eating out this month', save: 'Save', cancel: 'Cancel', noSaved: 'No saved filters yet.',
    deleteFilter: (name) => `Delete filter ${name}`, savedOk: 'Filter saved.', savedFailed: 'The filter was not saved. Please try again.',
    savedLimit: 'You can save up to 12 filters.', nothingToSave: 'Choose at least one filter before saving.',
    hasNote: 'Has a detailed note'
  },
  'zh-CN': {
    details: '标签、详细备注和票据照片', tags: '标签', tagsPlaceholder: '输入标签后按回车',
    tagsHint: (max) => `最多 ${max} 个标签，每个不超过 30 个字符。`, removeTag: (tag) => `移除标签 ${tag}`,
    longNote: '详细备注', longNotePlaceholder: '例如：与谁同行、保修到期时间…',
    receipts: '票据照片', addReceipt: '添加照片', receiptsHint: '最多 3 张。照片会在保存前自动压缩。',
    receiptInvalid: '无法读取此图片。请选择 JPEG、PNG 或 WebP 图片。',
    receiptFailed: '照片未能保存，请重试。', receiptsPartial: '交易已保存，但有照片上传失败。请重新打开该交易添加照片。',
    removeReceipt: '删除照片', viewReceipt: '查看票据照片', receiptLoading: '正在加载照片…', closeReceipt: '关闭照片',
    split: '将账单拆分到多个分类', splitHint: '上方金额为账单总额。未拆分的部分归入已选分类。',
    splitPart: (index) => `第 ${index} 部分`, splitCategory: '分类', splitAmount: '金额', splitAdd: '添加部分',
    splitRemove: '移除此部分', splitRemainder: (category, amount) => `${category} 剩余：${amount}`,
    splitOver: '拆分金额之和超过了账单总额。', splitIncomplete: '每个部分都需要分类和大于 0 的金额。',
    splitDuplicate: '每个分类只应出现一次。',
    splitSaved: (count, amount) => `已将 ${amount} 的账单保存为 ${count} 部分。`, splitBadge: '拆分账单',
    splitEditHint: '此记录是拆分账单的一部分。在此修改只会影响这一部分。',
    filterTag: '标签', allTags: '全部标签', amountRange: '金额范围', minAmount: '最低', maxAmount: '最高',
    amountChip: (min, max) => (min && max ? `${min} – ${max}` : min ? `${min} 起` : `至 ${max}`),
    amountInvalid: '最低金额高于最高金额。', apply: '应用', clearAmount: '清除金额筛选',
    savedFilters: '已保存的筛选', saveCurrent: '保存当前筛选', filterName: '筛选名称',
    filterNamePlaceholder: '例如：本月外出就餐', save: '保存', cancel: '取消', noSaved: '还没有已保存的筛选。',
    deleteFilter: (name) => `删除筛选 ${name}`, savedOk: '筛选已保存。', savedFailed: '筛选未能保存，请重试。',
    savedLimit: '最多可保存 12 个筛选。', nothingToSave: '保存前请至少选择一个筛选条件。',
    hasNote: '有详细备注'
  }
};

export const getTransactionExtrasCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
export const MAX_TAGS = 10;
/** Same normalisation as the server: trimmed, lower-case, unique, at most 30 characters. */
export const cleanTag = (value) => String(value || '').replace(/[#,]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 30);
