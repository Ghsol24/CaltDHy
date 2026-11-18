// Chữ của dòng ngân sách trong form giao dịch (đợt 10: FORM-01, FORM-11). Nằm cạnh form (tải
// theo nhu cầu) thay vì trong từ điển chung để ngân sách JavaScript khởi đầu không đổi.
// `limit` là cụm "hạn mức tháng này" / "hạn mức Tháng 9, 2026" do hàm gọi dựng theo kỳ đang chọn.
const COPY = {
  vi: {
    thisLimit: 'hạn mức tháng này', periodLimit: (period) => `hạn mức ${period}`, colon: ': ',
    left: ({ amount, limit }) => `còn ${amount} ${limit}`,
    leftAfter: ({ amount }) => `còn ${amount} sau khoản này`,
    over: ({ amount, limit }) => `đã vượt ${amount} ${limit}`,
    exceed: ({ amount }) => `khoản này làm vượt hạn mức ${amount}`,
    reached: ({ limit }) => `đã dùng hết ${limit}`,
    unset: 'chưa đặt hạn mức', setLimit: 'Đặt hạn mức ›',
    more: 'Thêm…', moreAria: 'Thêm danh mục khác'
  },
  en: {
    thisLimit: "this month's limit", periodLimit: (period) => `the ${period} limit`, colon: ': ',
    left: ({ amount, limit }) => `${amount} left in ${limit}`,
    leftAfter: ({ amount }) => `${amount} left after this`,
    over: ({ amount, limit }) => `${amount} over ${limit}`,
    exceed: ({ amount }) => `this puts you ${amount} over the limit`,
    reached: ({ limit }) => `${limit} is used up`,
    unset: 'no limit set', setLimit: 'Set a limit ›',
    more: 'More…', moreAria: 'More categories'
  },
  'zh-CN': {
    thisLimit: '本月额度', periodLimit: (period) => `${period}额度`, colon: '：',
    left: ({ amount, limit }) => `${limit}剩余 ${amount}`,
    leftAfter: ({ amount }) => `此笔之后剩余 ${amount}`,
    over: ({ amount, limit }) => `已超出${limit} ${amount}`,
    exceed: ({ amount }) => `这笔将超出额度 ${amount}`,
    reached: ({ limit }) => `${limit}已用完`,
    unset: '未设置额度', setLimit: '设置额度 ›',
    more: '更多…', moreAria: '更多分类'
  }
};

export const getBudgetLineCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
