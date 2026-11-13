// Text for the month-end forecast card and the advanced budget options. Loaded with those lazy screens only.
const COPY = {
  vi: {
    title: 'Dự báo cuối tháng', projected: 'Số dư dự kiến cuối tháng', projectedHint: (pace, days) => `Theo tốc độ chi ${pace}/ngày trong ${days} ngày còn lại, cộng các khoản định kỳ sắp đến hạn.`,
    lastDay: 'Hôm nay là ngày cuối tháng, đây là số dư hiện tại.', negative: 'Với tốc độ này bạn có thể thiếu tiền trước cuối tháng.',
    savingsRate: 'Tỷ lệ tiết kiệm tháng này', savingsNoIncome: 'Chưa có thu nhập tháng này', savingsHint: (income, expense) => `Thu ${income}, chi ${expense}`,
    upcoming: 'Sắp đến hạn trong tháng', upcomingNone: 'Không còn khoản định kỳ nào', upcomingCount: (count) => `${count} khoản`,
    noData: 'Ghi vài khoản chi trong tháng để có dự báo.', goals: 'Ước tính ngày hũ đạt mục tiêu',
    goalEta: (date, monthly) => `Dự kiến ${date} (khoảng ${monthly}/tháng)`, goalLate: 'Trễ hơn hạn đã đặt', goalStalled: 'Chưa đủ dữ liệu nạp gần đây để ước tính',
    goalDone: 'Đã đạt mục tiêu', expectedNote: 'Những ngày bạn đã đánh dấu “chi lớn có dự tính” không tính vào tốc độ chi.',
    advTitle: 'Ngân sách nâng cao', advEdit: 'Thiết lập', advTotal: 'Ngân sách tổng tháng', advWeekly: 'Ngân sách tuần này',
    advSpentOf: (spent, limit) => `${spent} / ${limit}`, advLeft: (amount) => `Còn ${amount}`, advOver: (amount) => `Vượt ${amount}`,
    advNotSet: 'Chưa đặt', advRollover: 'Chuyển phần dư sang tháng sau', advRolloverOn: 'Đang bật', advRolloverOff: 'Đang tắt',
    advRolloverHint: 'Hạn mức danh mục còn dư của tháng liền trước được cộng vào hạn mức tháng này.',
    advCarried: (amount) => `Đã cộng ${amount} từ tháng trước`, advNoCarry: 'Tháng trước không còn dư để chuyển sang.',
    advTotalLabel: 'Hạn mức tổng mỗi tháng', advWeeklyLabel: 'Hạn mức mỗi tuần (Thứ 2 – Chủ nhật)', advZeroHint: 'Để trống hoặc 0 nếu không dùng.',
    save: 'Lưu', cancel: 'Hủy', saved: 'Đã lưu tùy chọn ngân sách.', failed: 'Chưa lưu được. Vui lòng thử lại.',
    advEmpty: 'Đặt một hạn mức cho cả tháng hoặc cho từng tuần, và chọn có chuyển phần dư sang tháng sau hay không.'
  },
  en: {
    title: 'Month-end forecast', projected: 'Projected month-end balance', projectedHint: (pace, days) => `At ${pace}/day for the ${days} days left, plus recurring items still due.`,
    lastDay: 'Today is the last day of the month; this is your current balance.', negative: 'At this pace you may run short before the month ends.',
    savingsRate: 'Savings rate this month', savingsNoIncome: 'No income recorded this month', savingsHint: (income, expense) => `In ${income}, out ${expense}`,
    upcoming: 'Still due this month', upcomingNone: 'No recurring items left', upcomingCount: (count) => `${count} item${count === 1 ? '' : 's'}`,
    noData: 'Record a few expenses this month to see a forecast.', goals: 'When your jars should reach their goals',
    goalEta: (date, monthly) => `Around ${date} (about ${monthly}/month)`, goalLate: 'Later than your target date', goalStalled: 'Not enough recent deposits to estimate',
    goalDone: 'Goal reached', expectedNote: 'Days you marked as expected high-spend days are left out of the pace.',
    advTitle: 'Advanced budget', advEdit: 'Set up', advTotal: 'Overall monthly budget', advWeekly: 'This week’s budget',
    advSpentOf: (spent, limit) => `${spent} of ${limit}`, advLeft: (amount) => `${amount} left`, advOver: (amount) => `${amount} over`,
    advNotSet: 'Not set', advRollover: 'Roll leftovers into next month', advRolloverOn: 'On', advRolloverOff: 'Off',
    advRolloverHint: 'What was left of each category limit last month is added to this month’s limit.',
    advCarried: (amount) => `${amount} added from last month`, advNoCarry: 'Nothing was left over last month.',
    advTotalLabel: 'Overall limit per month', advWeeklyLabel: 'Limit per week (Monday – Sunday)', advZeroHint: 'Leave empty or 0 to turn it off.',
    save: 'Save', cancel: 'Cancel', saved: 'Budget options saved.', failed: 'Not saved. Please try again.',
    advEmpty: 'Set one limit for the whole month or for each week, and choose whether leftovers roll into the next month.'
  },
  'zh-CN': {
    title: '月末预测', projected: '预计月末余额', projectedHint: (pace, days) => `按每天 ${pace} 的支出速度计算剩余 ${days} 天，并计入即将到期的周期项目。`,
    lastDay: '今天是本月最后一天，这是当前余额。', negative: '按此速度，月底前可能出现资金不足。',
    savingsRate: '本月储蓄率', savingsNoIncome: '本月尚无收入', savingsHint: (income, expense) => `收入 ${income}，支出 ${expense}`,
    upcoming: '本月即将到期', upcomingNone: '没有待处理的周期项目', upcomingCount: (count) => `${count} 项`,
    noData: '本月记录几笔支出后即可查看预测。', goals: '储蓄罐预计达成时间',
    goalEta: (date, monthly) => `预计 ${date}（约每月 ${monthly}）`, goalLate: '晚于设定的期限', goalStalled: '近期存入数据不足，无法估算',
    goalDone: '已达成目标', expectedNote: '您标记为“预期大额支出”的日期不计入支出速度。',
    advTitle: '高级预算', advEdit: '设置', advTotal: '每月总预算', advWeekly: '本周预算',
    advSpentOf: (spent, limit) => `${spent} / ${limit}`, advLeft: (amount) => `剩余 ${amount}`, advOver: (amount) => `超出 ${amount}`,
    advNotSet: '未设置', advRollover: '将结余转入下月', advRolloverOn: '已开启', advRolloverOff: '已关闭',
    advRolloverHint: '上个月各分类限额的结余会加到本月限额中。',
    advCarried: (amount) => `已从上月转入 ${amount}`, advNoCarry: '上个月没有可转入的结余。',
    advTotalLabel: '每月总限额', advWeeklyLabel: '每周限额（周一至周日）', advZeroHint: '留空或填 0 表示不使用。',
    save: '保存', cancel: '取消', saved: '预算选项已保存。', failed: '未能保存，请重试。',
    advEmpty: '可为整月或每周设置一个限额，并选择是否将结余转入下月。'
  }
};
export const getForecastCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
