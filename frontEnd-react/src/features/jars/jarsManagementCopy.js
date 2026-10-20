const COPY = {
  vi: {
    createTitle: 'Tạo hũ tiết kiệm', editTitle: 'Chỉnh sửa hũ',
    createSubtitle: 'Đặt mục tiêu và để riêng tiền cho điều bạn muốn.', editSubtitle: 'Cập nhật thông tin mục tiêu của bạn.',
    name: 'Tên hũ', namePlaceholder: 'Ví dụ: Du lịch, Quỹ dự phòng', target: 'Mục tiêu', date: 'Ngày hoàn thành', optional: '(tùy chọn)',
    initial: 'Tiền đã để riêng', initialHint: 'Chỉ ghi nhận số tiền đã có trong hũ; không tự trừ từ ví. Muốn chuyển tiền từ ví, hãy tạo hũ rồi chọn Nạp tiền.',
    currentBalance: 'Số dư hiện tại', changeBalanceHint: 'Dùng Nạp tiền hoặc Rút tiền để thay đổi số dư và đồng bộ với ví.',
    color: 'Màu nhận diện', remaining: 'Cần tích lũy thêm', cancel: 'Hủy', close: 'Đóng', saving: 'Đang lưu…', saveChanges: 'Lưu thay đổi', createAction: 'Tạo hũ',
    nameRequired: 'Nhập tên hũ để tiếp tục.', targetRequired: 'Nhập mục tiêu là số tiền nguyên, lớn hơn 0 và không quá lớn.', initialInvalid: 'Tiền đã để riêng phải là số nguyên từ 0 trở lên và không quá lớn.',
    created: 'Đã tạo hũ “{name}”.', updated: 'Đã cập nhật hũ “{name}”.',
    emerald: 'Xanh lá', blue: 'Xanh dương', purple: 'Tím', orange: 'Cam', red: 'Đỏ', teal: 'Xanh ngọc', indigo: 'Chàm', amber: 'Vàng hổ phách', pink: 'Hồng',
    historyTitle: 'Lịch sử hũ', historyCap: 'Mỗi hũ lưu tối đa 200 hoạt động gần nhất.', totalDeposit: 'Tổng nạp', totalWithdraw: 'Tổng rút', net: 'Chênh lệch',
    filteredSummary: 'Thống kê theo bộ lọc', filterType: 'Loại hoạt động', all: 'Tất cả', deposit: 'Nạp', withdraw: 'Rút', allJars: 'Tất cả hũ', filterJar: 'Lọc theo hũ',
    search: 'Tìm tên hũ hoặc ghi chú', resultCount: '{count} hoạt động theo bộ lọc', empty: 'Không có hoạt động khớp với bộ lọc.', unknownDate: 'Chưa có ngày',
    depositDirection: 'Nạp vào hũ', withdrawDirection: 'Rút từ hũ',
  },
  en: {
    createTitle: 'Create a savings jar', editTitle: 'Edit jar',
    createSubtitle: 'Set a goal and put money aside for it.', editSubtitle: 'Update your savings goal details.',
    name: 'Jar name', namePlaceholder: 'For example: Travel, Emergency fund', target: 'Target', date: 'Target date', optional: '(optional)',
    initial: 'Money already set aside', initialHint: 'Records money already in this jar; no wallet is charged. To move money from a wallet, create the jar and choose Deposit.',
    currentBalance: 'Current balance', changeBalanceHint: 'Use Deposit or Withdraw to change the balance and keep your wallet in sync.',
    color: 'Jar color', remaining: 'Still to save', cancel: 'Cancel', close: 'Close', saving: 'Saving…', saveChanges: 'Save changes', createAction: 'Create jar',
    nameRequired: 'Enter a jar name to continue.', targetRequired: 'Enter a positive whole-number target within the supported range.', initialInvalid: 'The initial amount must be a non-negative whole number within the supported range.',
    created: 'Created jar “{name}”.', updated: 'Updated jar “{name}”.',
    emerald: 'Green', blue: 'Blue', purple: 'Purple', orange: 'Orange', red: 'Red', teal: 'Teal', indigo: 'Indigo', amber: 'Amber', pink: 'Pink',
    historyTitle: 'Jar history', historyCap: 'Each jar keeps up to 200 recent activities.', totalDeposit: 'Deposits', totalWithdraw: 'Withdrawals', net: 'Net change',
    filteredSummary: 'Summary for current filters', filterType: 'Activity type', all: 'All', deposit: 'Deposits', withdraw: 'Withdrawals', allJars: 'All jars', filterJar: 'Filter by jar',
    search: 'Search jar names or notes', resultCount: '{count} matching activities', empty: 'No activities match these filters.', unknownDate: 'Date unavailable',
    depositDirection: 'Added to jar', withdrawDirection: 'Withdrawn from jar',
  },
  'zh-CN': {
    createTitle: '创建储蓄罐', editTitle: '编辑储蓄罐', createSubtitle: '设定目标，为想做的事存钱。', editSubtitle: '更新储蓄目标信息。',
    name: '储蓄罐名称', namePlaceholder: '例如：旅行、应急基金', target: '目标金额', date: '目标日期', optional: '（可选）',
    initial: '已留存金额', initialHint: '仅记录储蓄罐中已有的金额，不会从钱包扣款。如需从钱包转入，请先创建储蓄罐，再选择存入。',
    currentBalance: '当前余额', changeBalanceHint: '请通过存入或取出更改余额，同时更新钱包。', color: '标识颜色', remaining: '还需存入',
    cancel: '取消', close: '关闭', saving: '保存中…', saveChanges: '保存更改', createAction: '创建储蓄罐',
    nameRequired: '请输入储蓄罐名称。', targetRequired: '目标金额须为大于 0 且在支持范围内的整数。', initialInvalid: '已留存金额须为不小于 0 且在支持范围内的整数。',
    created: '已创建储蓄罐“{name}”。', updated: '已更新储蓄罐“{name}”。',
    emerald: '绿色', blue: '蓝色', purple: '紫色', orange: '橙色', red: '红色', teal: '青色', indigo: '靛蓝色', amber: '琥珀色', pink: '粉色',
    historyTitle: '储蓄罐记录', historyCap: '每个储蓄罐最多保留最近 200 条活动。', totalDeposit: '存入总额', totalWithdraw: '取出总额', net: '净变化',
    filteredSummary: '当前筛选的统计', filterType: '活动类型', all: '全部', deposit: '存入', withdraw: '取出', allJars: '所有储蓄罐', filterJar: '按储蓄罐筛选',
    search: '搜索储蓄罐名称或备注', resultCount: '{count} 条匹配活动', empty: '没有符合筛选条件的活动。', unknownDate: '日期不详',
    depositDirection: '存入储蓄罐', withdrawDirection: '从储蓄罐取出',
  },
};

export function jarsManagementText(lang, key, values = {}) {
  const template = COPY[lang]?.[key] ?? COPY.vi[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
