const languages = { vi: 0, en: 1, 'zh-CN': 2 };
const sections = [
  ['quickstart', ['Bắt đầu nhanh', 'Quick start', '快速开始'], [
    [['1. Khai báo ví', '1. Set up wallets', '1. 设置钱包'],
      ['Thêm ví và số dư ban đầu. Tiền đã có chỉ cần khai báo một lần, tránh ghi thêm thành thu nhập.', 'Add wallets and opening balances. Record existing money once; do not also enter it as income.', '添加钱包及初始余额。已有资金只需记录一次，请勿再次记为收入。'], 'wallets'],
    [['2. Đặt ngân sách', '2. Set a budget', '2. 设置预算'],
      ['Chọn tháng, đặt hạn mức cho từng danh mục. Ngân sách giúp theo dõi chi tiêu, không giữ hay trừ tiền trong ví.', 'Choose a month and category limits. Budgets track spending; they do not reserve or deduct wallet money.', '选择月份并设置分类限额。预算用于跟踪支出，不会冻结或扣除钱包资金。'], 'budgets'],
    [['3. Ghi thu, chi', '3. Record transactions', '3. 记录交易'],
      ['Chọn Thêm giao dịch, loại giao dịch, ví, số tiền và ngày. Dùng Chuyển khoản khi tiền di chuyển giữa hai ví của bạn.', 'Choose Add transaction, then type, wallet, amount and date. Use Transfer for money moving between your own wallets.', '点击添加交易，选择类型、钱包、金额及日期。自己的两个钱包之间移动资金请选择转账。'], 'transaction'],
    [['4. Kiểm tra và điều chỉnh', '4. Review and adjust', '4. 查看并调整'],
      ['Xem Phân tích để kiểm tra thu chi; mở Lịch sử để tìm và sửa giao dịch nhập sai.', 'Review income and expenses in Analytics; use History to find and correct an entry.', '在分析中查看收支；在历史记录中查找并修改录入错误的交易。'], 'analytics']
  ]],
  ['home', ['Trang chủ', 'Home', '首页'], [
    [['Tiền có thể chi còn lại', 'Available to spend', '剩余可支配金额'],
      ['Là số dư các ví được tính vào tiền khả dụng, bỏ qua ví lưu trữ và thẻ tín dụng. Tiền chuyển vào hũ đã rời ví nguồn nên không bị trừ lần nữa. Hóa đơn chưa trả chưa được trừ trước.', 'This is the balance of eligible spending wallets, excluding archived wallets and credit cards. Jar transfers already reduce the source wallet. Unpaid bills are not deducted in advance.', '这是可计入可用资金的钱包余额，不含已归档钱包及信用卡。转入储蓄罐的金额已从来源钱包扣除；未付账单不会提前扣除。']],
    [['Thêm giao dịch', 'Add a transaction', '添加交易'],
      ['Chi tiêu làm giảm ví; Thu nhập làm tăng ví. Chuyển khoản chỉ chuyển tiền giữa các ví, không cộng vào thu/chi tháng. Với chi tiêu, phí nhập kèm được tính vào tổng chi.', 'Expense reduces a wallet; Income increases it. Transfers move existing money and are excluded from monthly income/expenses. An expense includes its entered fee.', '支出减少钱包余额，收入增加余额。转账只移动已有资金，不计入月度收支。支出总额包含录入的手续费。'], 'transaction'],
    [['Cần chú ý và giao dịch gần đây', 'Alerts and recent transactions', '提醒与近期交易'],
      ['Cảnh báo ngân sách xuất hiện từ 75% hạn mức; từ 100% là đã chạm hoặc vượt hạn mức. Chọn giao dịch để xem/sửa; chọn Xem tất cả để mở bộ lọc lịch sử.', 'Budget alerts start at 75%; 100% means the limit is reached or exceeded. Select an entry to inspect/edit it, or View all for history filters.', '预算使用达到75%时提醒，达到100%表示已触及或超过限额。点击交易查看或编辑，点击查看全部使用历史筛选。'], 'history']
  ]],
  ['plan', ['Kế hoạch', 'Planning', '计划'], [
    [['Ví & Tài khoản', 'Wallets & accounts', '钱包与账户'],
      ['Thêm ví với số dư ban đầu; đặt ví mặc định để được chọn sẵn khi nhập. Dùng Chuyển tiền giữa các ví. Lưu trữ ví giữ lại lịch sử và có thể mở lại sau.', 'Add wallets with opening balances and choose a default for new entries. Use Transfer between wallets. Archiving preserves history and allows reopening later.', '添加钱包及初始余额，设置默认钱包供新交易预选。钱包间使用转账。归档保留历史，之后可重新启用。'], 'wallets'],
    [['Ngân sách theo tháng', 'Monthly budgets', '月度预算'],
      ['Chọn đúng tháng rồi đặt/sửa hạn mức từng danh mục. Chi thực tế gồm khoản định kỳ đã ghi nhận và phí của giao dịch chi tiêu. Hết kỳ ngân sách và vượt hạn mức là hai trạng thái khác nhau.', 'Select the month before setting category limits. Actual expenses include recorded recurring payments and expense fees. A closed month and an overspent budget are separate states.', '设置分类限额前先选择月份。实际支出包含已记录的周期付款及支出手续费。月份已结束与预算超额是不同状态。'], 'budgets'],
    [['Khoản định kỳ', 'Recurring items', '周期项目'],
      ['Thêm số tiền, chu kỳ, ngày đến hạn và ví trừ tiền. Khi đánh dấu Đã trả kỳ này, ứng dụng ghi một khoản chi và chuyển sang kỳ kế tiếp. Đây là ghi chép trong ứng dụng; bạn vẫn tự thanh toán hóa đơn bên ngoài.', 'Set amount, cycle, due date and payment wallet. Marking a period paid records an expense and advances the due date. This records the payment in the app; pay the actual bill separately.', '设置金额、周期、到期日及付款钱包。标记本期已付会记录支出并推进下次到期日。这仅记录付款，实际账单仍需另行支付。'], 'recurring'],
    [['Tạm dừng hoặc kết thúc', 'Pause or finish', '暂停或结束'],
      ['Dùng menu ⋮ để chỉnh sửa hoặc tạm dừng theo dõi; đặt ngày kết thúc cho khoản có thời hạn. Chi phí ước tính/tháng là số quy đổi, không phải tiền vừa bị trừ.', 'Use the ⋮ menu to edit or pause tracking; set an end date for a finite schedule. Estimated monthly cost is a normalized estimate, not a new deduction.', '使用⋮菜单编辑或暂停跟踪；有限期项目可设置结束日期。月均预估费用是换算值，并非新扣款。']]
  ]],
  ['analytics', ['Phân tích', 'Analytics', '分析'], [
    [['Chọn đúng kỳ xem', 'Choose a period', '选择查看期间'],
      ['Tổng quan và Chi tiêu tóm tắt thu, chi và cơ cấu danh mục của kỳ đang chọn. Số dư ví là tiền hiện có; thu trừ chi là kết quả trong kỳ, hai số này có thể khác nhau.', 'Overview and Spending summarize the selected period and categories. Wallet balance is current money; income minus expenses measures the period, so the two can differ.', '总览及支出显示所选期间的收支及分类。钱包余额是当前资金，收入减支出是期间结果，两者可能不同。'], 'analytics'],
    [['Xu hướng dòng tiền', 'Cash flow trend', '现金流趋势'],
      ['Chọn theo ngày, 3 tháng hoặc 6 tháng; bấm cột/ngày để xem giao dịch. Ẩn khoản định kỳ chỉ đổi dữ liệu đang xem. Ghim để chọn cách xem mặc định cho lần mở sau.', 'Choose daily, three-month or six-month views; select a bar/day for transactions. Hiding recurring items changes the view only. Pin a view to make it the entry default.', '选择按日、三个月或六个月查看；点击柱形或日期查看交易。隐藏周期项目只影响展示。固定视图可设为下次打开的默认视图。'], 'cashflow'],
    [['Lịch sử và sửa giao dịch', 'History and corrections', '历史与修改'],
      ['Tìm mô tả; lọc loại, danh mục, ví hoặc thời gian. Sửa giao dịch cũ có thể đổi số dư hiện tại và báo cáo tháng cũ: đọc phần ảnh hưởng trước khi xác nhận. Giao dịch hũ/định kỳ được quản lý tại mục nguồn.', 'Search descriptions and filter by type, category, wallet or date. Editing old entries can change current balances and past reports; review the impact before confirming. Manage jar/recurring entries in their source section.', '按描述搜索，并按类型、分类、钱包或时间筛选。修改旧交易可能影响当前余额及历史报表，请先查看影响。储蓄罐及周期交易在来源功能中管理。'], 'history'],
    [['Báo cáo', 'Reports', '报表'],
      ['Chọn kỳ trước khi xuất CSV hoặc in báo cáo. Bản xuất toàn bộ dữ liệu nằm trong Cài đặt.', 'Choose the period before exporting CSV or printing. For a full data export, use Settings.', '导出CSV或打印前先选择期间。需要完整数据导出时请使用设置。'], 'reports']
  ]],
  ['jars', ['Hũ chi tiêu', 'Savings jars', '储蓄罐'], [
    [['Tạo hũ theo mục tiêu', 'Create a goal jar', '创建目标储蓄罐'],
      ['Chọn Tạo hũ mới, nhập tên và mục tiêu; ngày hoàn thành là tùy chọn. Bạn tự tạo số hũ cần dùng. Số tiền đã có khi tạo là số dư ban đầu của hũ, không tự trừ từ ví.', 'Choose Create jar, enter a name and target; a deadline is optional. Create as many goal jars as needed. An opening jar balance does not automatically deduct from a wallet.', '点击创建储蓄罐，输入名称及目标金额；完成日期可选。可按需创建目标罐。初始储蓄金额不会自动从钱包扣除。'], 'jars'],
    [['Nạp và rút: chuyển tiền nội bộ', 'Deposit and withdraw: internal transfers', '存入与取出：内部转账'],
      ['Chọn hũ → Nạp/Rút → số tiền → ví liên kết → xác nhận. Nạp chuyển từ ví vào hũ; rút chuyển từ hũ về ví. Cả hai không phải thu nhập hay chi tiêu mới. Khi mua hàng, ghi thêm Chi tiêu từ ví.', 'Choose a jar → Deposit/Withdraw → amount → linked wallet → confirm. Deposits move wallet money into a jar; withdrawals return it. Neither is new income or expense. Record an Expense when spending the money.', '选择储蓄罐→存入或取出→金额→关联钱包→确认。存入从钱包转至罐内，取出返回钱包，都不构成新收支。实际消费时另记钱包支出。']],
    [['Theo dõi, sửa và xóa', 'Track, edit and delete', '跟踪、编辑及删除'],
      ['Mục tiêu xem tiến độ; Danh sách hũ để thao tác; Lịch sử xem các lần nạp/rút. Sửa tên, mục tiêu hoặc thời hạn trong menu hũ. Đổi số dư bằng Nạp/Rút; rút hết về ví trước khi xóa hũ.', 'Goals shows progress; Jar list provides actions; History records deposits and withdrawals. Edit names, targets or deadlines in the jar menu. Change balances through Deposit/Withdraw; empty the jar into a wallet before deleting.', '目标页显示进度，储蓄罐列表提供操作，历史记录存取。通过罐菜单编辑名称、目标或期限。使用存入及取出调整余额；删除前先将余额全部转回钱包。'], 'jarhistory']
  ]],
  ['settings', ['Cài đặt', 'Settings', '设置'], [
    [['Giao diện và hiển thị', 'Appearance and display', '外观与显示'],
      ['Mở Cài đặt để đổi giao diện, ngôn ngữ và đơn vị hiển thị. USD chỉ dùng khi có tỷ giá; dữ liệu gốc và số tiền nhập vẫn theo VND.', 'Open Settings to change theme, language and display currency. USD requires an available rate; stored data and entered amounts remain in VND.', '打开设置更改主题、语言及显示币种。USD显示需要可用汇率；原始数据及输入金额仍以VND为单位。'], 'settings'],
    [['Hồ sơ và bảo mật', 'Profile and security', '个人资料与安全'],
      ['Bấm tên/ảnh đại diện để mở Hồ sơ. Đổi email hoặc mật khẩu cần mật khẩu hiện tại; các phiên đăng nhập cũ sẽ hết hiệu lực.', 'Select your name/avatar to open Profile. Changing email or password requires the current password and invalidates old sessions.', '点击姓名或头像打开个人资料。更改邮箱或密码需要当前密码，旧登录会话将失效。'], 'profile'],
    [['Xuất và đặt lại dữ liệu', 'Export and reset data', '导出及重置数据'],
      ['Trong Dữ liệu & Quyền riêng tư, Xuất JSON tải dữ liệu về máy. Đặt lại dữ liệu yêu cầu nhập RESET và xóa dữ liệu tài chính của tài khoản. Nên xuất trước; hiện chưa có thao tác nhập lại JSON trong giao diện.', 'In Data & privacy, Export JSON downloads your data. Reset requires typing RESET and removes the account’s financial data. Export first; the interface currently has no JSON import action.', '在数据与隐私中，导出JSON可下载数据。重置需输入RESET并删除账户财务数据。建议先导出；当前界面没有JSON导入功能。'], 'data']
  ]]
];

export function getGuideContent(lang) {
  const index = languages[lang] ?? 0;
  const pick = (values) => values[index];
  return {
    title: pick(['Hướng dẫn sử dụng CaltDHy', 'CaltDHy user guide', 'CaltDHy 使用指南']),
    intro: pick(['Bắt đầu với 4 thao tác', 'Start with four actions', '从四项操作开始']),
    open: pick(['Mở mục này →', 'Open this section →', '打开此功能 →']),
    close: pick(['Đóng hướng dẫn', 'Close guide', '关闭指南']),
    done: pick(['Đã hiểu & Đóng', 'Done & close', '完成并关闭']),
    more: pick(['Xem hướng dẫn', 'View guide', '查看指南']),
    understood: pick(['Đã hiểu', 'Got it', '明白了']),
    hint: pick(['Gợi ý cho', 'Tips for', '使用提示']),
    tabs: sections.map(([id, title, items]) => ({ id, title: pick(title),
      sections: items.map(([heading, body, action]) => ({ title: pick(heading), body: pick(body), action })) }))
  };
}
