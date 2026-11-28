// Đợt 16: chữ có kèm số/tiền trước đây bị React tách thành nhiều text node
// ("Ngân sách tháng " + "11"), nên mẫu dịch không khớp và bản en/zh-CN hiện lẫn
// tiếng Việt. Các chỗ đó giờ dựng thành một chuỗi; mẫu dịch của chúng ở đây.
// Mẫu ở đây được thử TRƯỚC các mẫu chung trong legacyTranslations.js.

const enMonth = (month) => new Date(2000, Number(month) - 1, 1).toLocaleString('en-US', { month: 'long' });

const BUDGET_PILL = {
  'Vượt': ['Over', '超出'],
  'Chạm': ['At limit', '已达上限'],
  'Cận trần': ['Near limit', '接近上限'],
  'An toàn': ['Safe', '安全'],
};

export const splitTextEntries = [
  ['Chi tiêu theo danh mục', 'Spending by category', '分类支出'],
  ['+ Thêm giao dịch ngay', '+ Add a transaction', '+ 立即添加交易'],
  ['Thêm các giao dịch chi tiêu mới để hệ thống tự động phân loại và trực quan hóa tỷ trọng từng nhóm chi phí.',
    'Add spending transactions and CaltDHy will group them by category and chart the share of each.',
    '添加支出交易后，CaltDHy 会自动按分类整理并以图表显示各类支出的占比。'],
  ['để đạt mục tiêu', 'to reach the goal', '即可达成目标'],
  ['nữa là đến hạn. Bạn có thể phân bổ:', 'until the due date. You could set aside:', '后到期。你可以这样分配：'],
  ['Đã dùng', 'Used', '已用'],
  ['còn lại', 'remaining', '剩余'],
  ['Chuyển giữa các ví', 'Between wallets', '钱包间转账'],
  // Wallets master–detail panes (đợt 15d) had no en/zh-CN entries yet.
  ['Giao dịch', 'Transactions', '交易'],
  ['Lần cuối dùng', 'Last used', '上次使用'],
  ['Giao dịch của ví này', 'Transactions in this wallet', '此钱包的交易'],
  ['Xem toàn bộ lịch sử', 'View full history', '查看全部记录'],
  ['Ví này chưa có giao dịch nào.', 'This wallet has no transactions yet.', '此钱包还没有交易。'],
  ['Thêm giao dịch đầu tiên', 'Add the first transaction', '添加第一笔交易'],
  ['Tất cả ví', 'All wallets', '全部钱包'],
  ['Chưa có giao dịch nào.', 'No transactions yet.', '还没有交易。'],
  ['Báo cáo tổng hợp tài chính', 'Financial summary report', '财务汇总报告'],
  ['Nhận định & Khuyến nghị tài chính kỳ này', 'Insights & recommendations for this period', '本期财务洞察与建议'],
  ['(Đối chiếu với kỳ liền kề:', '(Compared with the previous period:', '（对比上一周期：'],
];

export const splitTextTemplates = [
  // Plan overview tip when a category is over its limit (one template string, but the
  // generic "… vượt hạn mức …" pattern below used to grab only half of it).
  [/^(.+) đã chi (.+), vượt hạn mức (.+)\. Nếu mức chi này là bình thường, hãy nâng hạn mức cho sát thực tế; nếu không, xem lại các khoản chi ở danh mục này\.$/,
    (locale, category, spent, over) => locale === 'en'
      ? `${category} has spent ${spent}, ${over} over its limit. If this is normal for you, raise the limit to match; if not, review the spending in this category.`
      : `${category} 已支出 ${spent}，超出限额 ${over}。如果这是正常水平，请把限额调到符合实际；否则请检查该分类的支出。`],
  [/^Ngân sách tháng (\d{1,2})$/, (locale, month) => locale === 'en' ? `${enMonth(month)} budget` : `${month} 月预算`],
  [/^Trong tháng (\d{1,2})$/, (locale, month) => locale === 'en' ? `In ${enMonth(month)}` : `${month} 月内`],
  [/^Tiền vào tháng (\d{1,2})$/, (locale, month) => locale === 'en' ? `Money in · ${enMonth(month)}` : `${month} 月流入`],
  [/^Tiền ra tháng (\d{1,2})$/, (locale, month) => locale === 'en' ? `Money out · ${enMonth(month)}` : `${month} 月流出`],
  [/^(\d+) tài khoản$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'account' : 'accounts'}` : `${count} 个账户`],
  [/^(\d+) khoản đang theo dõi$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'item' : 'items'} tracked` : `跟踪中 ${count} 项`],
  [/^~(.+) \/ tháng$/, (locale, amount) => locale === 'en' ? `~${amount} / month` : `约 ${amount} / 月`],
  [/^(\d+) ngày$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'day' : 'days'}` : `${count} 天`],
  [/^(\d+) mục tiêu$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'goal' : 'goals'}` : `${count} 个目标`],
  [/^(\d+) lần$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'time' : 'times'}` : `${count} 次`],
  [/^Lịch sử nạp \/ rút \((\d+)\)$/, (locale, count) => locale === 'en' ? `Deposits & withdrawals (${count})` : `存取记录 (${count})`],
  [/^(\d+)–(\d+) \/ (\d+) hũ$/, (locale, from, to, total) => locale === 'en' ? `${from}–${to} of ${total} jars` : `第 ${from}–${to} 个，共 ${total} 个储蓄罐`],
  [/^Còn thiếu: (.+)$/, (locale, amount) => locale === 'en' ? `${amount} to go` : `还差 ${amount}`],
  [/^Ví đã lưu trữ \((\d+)\)$/, (locale, count) => locale === 'en' ? `Archived wallets (${count})` : `已归档钱包 (${count})`],
  [/^Toàn bộ (\d+) giao dịch đã ghi nhận$/, (locale, count) => locale === 'en' ? `All ${count} recorded transactions` : `全部 ${count} 笔已记录交易`],
  [/^(Vượt|Chạm|Cận trần|An toàn) \((\d+)%\)$/, (locale, state, percent) => `${BUDGET_PILL[state][locale === 'en' ? 0 : 1]} (${percent}%)`],
  [/^(\d+) ví tính vào tổng(?: · (\d+) ví không tính)?$/, (locale, included, excluded) => locale === 'en'
    ? `${included} counted in total${excluded ? ` · ${excluded} not counted` : ''}`
    : `${included} 个计入总额${excluded ? ` · ${excluded} 个不计入` : ''}`],
  [/^(Tổng số dư|Số dư) (\d+) ngày qua$/, (locale, kind, days) => {
    const total = kind === 'Tổng số dư';
    return locale === 'en' ? `${total ? 'Total balance' : 'Balance'}, last ${days} days` : `近 ${days} 天${total ? '总余额' : '余额'}`;
  }],
  [/^Tổng số dư · (\d+) ví$/, (locale, count) => locale === 'en' ? `Total balance · ${count} ${Number(count) === 1 ? 'wallet' : 'wallets'}` : `总余额 · ${count} 个钱包`],
  [/^Không có giao dịch trong (\d+) ngày qua$/, (locale, days) => locale === 'en' ? `No transactions in the last ${days} days` : `近 ${days} 天没有交易`],
  [/^Kỳ trước: (.+)$/, (locale, value) => locale === 'en' ? `Previous period: ${value}` : `上期：${value}`],
];
