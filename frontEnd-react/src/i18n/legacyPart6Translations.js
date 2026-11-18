// Chữ mới của đợt 10 (audit Phần 6: Hũ tiết kiệm và form giao dịch). Tách riêng khỏi
// legacyTranslations.js để hai phần làm song song không đụng cùng chỗ khi gộp.
export const part6Entries = [
  ['Tổng quan hũ', 'Jar overview', '储蓄罐总览'],
  ['Số hũ', 'Jars', '储蓄罐数'],
  ['Chưa hũ nào đặt hạn', 'No jar has a due date', '尚无储蓄罐设置期限'],
  ['Tiến độ tổng của các hũ', 'Overall progress of your jars', '储蓄罐总体进度'],
  ['Tháng này chưa nạp thêm', 'Nothing added this month', '本月尚未存入'],
  ['Đúng tiến độ', 'On track', '进度正常'],
  ['Chưa nạp lần nào', 'No deposit yet', '尚未存入'],
  ['Đặt ngày đến hạn', 'Set a due date', '设置到期日'],
  ['Thêm ghi chú', 'Add a note', '添加备注'],
];

export const part6Templates = [
  [/^(\d+) hũ có hạn$/, (locale, count) => locale === 'en' ? `${count} ${Number(count) === 1 ? 'jar has' : 'jars have'} a due date` : `${count} 个储蓄罐有期限`],
  [/^([\d.,]+%) mục tiêu$/, (locale, percent) => locale === 'en' ? `${percent} of goal` : `目标的 ${percent}`],
  [/^còn thiếu (.+)$/, (locale, amount) => locale === 'en' ? `${amount} to go` : `还差 ${amount}`],
  [/^(\d+)% · còn thiếu (.+)$/, (locale, percent, amount) => locale === 'en' ? `${percent}% · ${amount} to go` : `${percent}% · 还差 ${amount}`],
  [/^(.+) trong tháng này$/, (locale, amount) => locale === 'en' ? `${amount} this month` : `本月 ${amount}`],
];
