'use strict';

const supported = new Set(['vi', 'en', 'zh-CN']);

function normalizeLocale(header = '') {
    const first = String(header).split(',')[0].trim().toLowerCase();
    if (first.startsWith('zh')) return 'zh-CN';
    if (first.startsWith('en')) return 'en';
    return 'vi';
}

const common = {
    'Không thể hoàn thành yêu cầu.': ['Unable to complete the request.', '无法完成请求。'],
    'Không thể hoàn thành yêu cầu. Vui lòng thử lại.': ['Unable to complete the request. Please try again.', '无法完成请求，请重试。'],
    'Dữ liệu không hợp lệ.': ['Invalid data.', '数据无效。'],
    'Dữ liệu yêu cầu không hợp lệ.': ['Invalid request data.', '请求数据无效。'],
    'Ngày không hợp lệ.': ['Invalid date.', '日期无效。'],
    'Định dạng ngày không hợp lệ (YYYY-MM-DD).': ['Invalid date format (YYYY-MM-DD).', '日期格式无效（YYYY-MM-DD）。'],
    'Vui lòng điền đầy đủ thông tin bắt buộc.': ['Complete all required fields.', '请填写所有必填信息。'],
    'Vui lòng điền đầy đủ các thông tin bắt buộc.': ['Complete all required fields.', '请填写所有必填信息。'],
    'Số tiền phải là số nguyên lớn hơn 0.': ['The amount must be a whole number greater than zero.', '金额必须是大于零的整数。'],
    'Số tiền phải là số nguyên lớn hơn 0 (VNĐ không có phần thập phân).': ['The amount must be a whole VND value greater than zero.', '金额必须是大于零的 VND 整数。'],
    'Số tiền phải là số nguyên VNĐ trong miền chính xác.': ['The amount must be an exact whole VND value.', '金额必须是精确范围内的 VND 整数。'],
    'Chu kỳ không hợp lệ.': ['Invalid recurrence cycle.', '周期无效。'],
    'Danh mục không hợp lệ.': ['Invalid category.', '分类无效。'],
    'Tên không được để trống.': ['Name is required.', '名称不能为空。'],
    'API không tồn tại.': ['API endpoint not found.', 'API 接口不存在。'],
    'Không tìm thấy tài nguyên.': ['Resource not found.', '未找到资源。'],
    'Đường dẫn không hợp lệ.': ['Invalid path.', '路径无效。'],
    'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.': ['Too many requests. Try again in 15 minutes.', '请求过多，请在 15 分钟后重试。'],
    'Dịch vụ dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.': ['The data service is not ready. Please try again later.', '数据服务尚未就绪，请稍后重试。'],
    'Dịch vụ xác thực chưa sẵn sàng. Vui lòng thử lại.': ['The authentication service is not ready. Please try again.', '身份验证服务尚未就绪，请重试。'],
    'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.': ['Your session is invalid or has expired. Sign in again.', '登录会话无效或已过期，请重新登录。'],
    'Phiên xác thực yêu cầu đã thay đổi. Vui lòng thử lại.': ['Request authentication changed. Please try again.', '请求身份验证已更改，请重试。'],
    'Giao dịch chưa được xác nhận. Hãy thử lại với cùng mã yêu cầu.': ['The transaction was not confirmed. Retry with the same request key.', '交易尚未确认，请使用相同的请求密钥重试。'],
    'Số dư ví không đủ hoặc vượt hạn mức tín dụng.': ['The wallet balance is insufficient or exceeds its credit limit.', '钱包余额不足或已超出信用额度。'],
    'Số dư hũ không hợp lệ.': ['The jar balance is invalid.', '储蓄罐余额无效。'],
    'Tổng tài sản vượt miền số nguyên chính xác.': ['Total assets exceed the exact integer range.', '总资产超出精确整数范围。'],
    'Dữ liệu liên kết không tồn tại hoặc không thuộc tài khoản.': ['Linked data does not exist or does not belong to this account.', '关联数据不存在或不属于此账户。'],
    'ID liên kết không hợp lệ.': ['Invalid linked ID.', '关联 ID 无效。'],
};

const auth = {
    'Thông tin tài khoản đã được sử dụng.': ['These account details are already in use.', '该账户信息已被使用。'],
    'Tên/email không hợp lệ. Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte.': ['Invalid name or email. The password must be 12 characters or more and at most 72 bytes.', '姓名或邮箱无效。密码至少 12 个字符且不超过 72 字节。'],
    'Đăng ký thành công!': ['Account created successfully.', '注册成功！'],
    'Cần liên kết mời hợp lệ để tạo tài khoản.': ['A valid invitation link is required to create an account.', '创建账户需要有效的邀请链接。'],
    'Liên kết mời không hợp lệ hoặc đã hết hạn.': ['The invitation link is invalid or has expired.', '邀请链接无效或已过期。'],
    'Chức năng gửi email chưa sẵn sàng. Vui lòng liên hệ chủ ứng dụng.': ['Email is not available yet. Please contact the app owner.', '邮件功能尚未就绪，请联系应用所有者。'],
    'Email hoặc mật khẩu không hợp lệ.': ['Invalid email or password.', '邮箱或密码无效。'],
    'Email hoặc mật khẩu không đúng.': ['Incorrect email or password.', '邮箱或密码错误。'],
    'Đăng nhập thành công!': ['Signed in successfully.', '登录成功！'],
    'Liên kết xác minh không hợp lệ.': ['Invalid verification link.', '验证链接无效。'],
    'Liên kết không hợp lệ hoặc đã hết hạn.': ['The link is invalid or has expired.', '链接无效或已过期。'],
    'Email đã được xác minh.': ['Email verified.', '邮箱已验证。'],
    'Nếu email phù hợp, hệ thống sẽ xử lý yêu cầu gửi liên kết.': ['If the email matches an account, a link request will be processed.', '如果邮箱与账户匹配，系统将处理链接请求。'],
    'Thông tin không hợp lệ. Mật khẩu cần 12 ký tự, tối đa 72 byte.': ['Invalid information. The password must be at least 12 characters and at most 72 bytes.', '信息无效。密码至少 12 个字符且不超过 72 字节。'],
    'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.': ['Password reset. Please sign in again.', '密码已重置，请重新登录。'],
    'Thông tin tài khoản không hợp lệ.': ['Invalid account information.', '账户信息无效。'],
    'Kích thước ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 1MB.': ['The image is too large. Choose an image under 1 MB.', '图片过大，请选择小于 1 MB 的图片。'],
    'Cập nhật tài khoản thành công!': ['Account updated successfully.', '账户更新成功！'],
};

const finance = {
    'Không tìm thấy ví.': ['Wallet not found.', '未找到钱包。'],
    'ID ví không hợp lệ.': ['Invalid wallet ID.', '钱包 ID 无效。'],
    'Tên ví không được để trống.': ['Wallet name is required.', '钱包名称不能为空。'],
    'Tạo ví mới thành công!': ['Wallet created successfully.', '钱包创建成功！'],
    'Cập nhật ví thành công!': ['Wallet updated successfully.', '钱包更新成功！'],
    'Lỗi khi lấy danh sách ví.': ['Unable to load wallets.', '无法加载钱包列表。'],
    'Lỗi khi tạo ví mới.': ['Unable to create the wallet.', '无法创建钱包。'],
    'Lỗi khi cập nhật ví.': ['Unable to update the wallet.', '无法更新钱包。'],
    'Lỗi khi xóa ví.': ['Unable to delete the wallet.', '无法删除钱包。'],
    'Lỗi khi đóng ví.': ['Unable to archive the wallet.', '无法归档钱包。'],
    'Lỗi khi mở lại ví.': ['Unable to reopen the wallet.', '无法重新打开钱包。'],
    'Bạn không thể xóa ví duy nhất còn lại.': ['You cannot delete the only remaining wallet.', '不能删除唯一剩余的钱包。'],
    'Không thể đóng ví mặc định. Vui lòng chọn một ví khác làm mặc định trước.': ['The default wallet cannot be archived. Choose another default wallet first.', '无法归档默认钱包，请先选择另一个默认钱包。'],
    'Bạn không thể đóng ví hoạt động duy nhất còn lại.': ['You cannot archive the only active wallet.', '不能归档唯一仍在使用的钱包。'],
    'Không tìm thấy hũ.': ['Jar not found.', '未找到储蓄罐。'],
    'ID hũ không hợp lệ.': ['Invalid jar ID.', '储蓄罐 ID 无效。'],
    'Tên và mục tiêu không được để trống.': ['Jar name and target are required.', '储蓄罐名称和目标不能为空。'],
    'Mục tiêu phải là số nguyên lớn hơn 0 (VNĐ không có phần thập phân).': ['The target must be a whole VND value greater than zero.', '目标必须是大于零的 VND 整数。'],
    'Đã tạo hũ mới!': ['Jar created successfully.', '储蓄罐创建成功！'],
    'Đã cập nhật hũ!': ['Jar updated successfully.', '储蓄罐更新成功！'],
    'Đã nạp tiền vào hũ!': ['Money added to the jar.', '已存入储蓄罐！'],
    'Đã rút tiền từ hũ!': ['Money withdrawn from the jar.', '已从储蓄罐取出资金！'],
    'Số tiền rút vượt quá số dư trong hũ.': ['The withdrawal exceeds the jar balance.', '取出金额超过储蓄罐余额。'],
    'Hãy rút hết tiền về ví trước khi xóa hũ.': ['Withdraw all money to a wallet before deleting the jar.', '删除储蓄罐前，请先将全部资金转回钱包。'],
    'Lỗi khi lấy danh sách hũ.': ['Unable to load jars.', '无法加载储蓄罐列表。'],
    'Lỗi khi tạo hũ.': ['Unable to create the jar.', '无法创建储蓄罐。'],
    'Lỗi khi cập nhật hũ.': ['Unable to update the jar.', '无法更新储蓄罐。'],
    'Lỗi khi nạp tiền.': ['Unable to add money.', '无法存入资金。'],
    'Lỗi khi rút tiền.': ['Unable to withdraw money.', '无法取出资金。'],
    'Lỗi khi xóa hũ.': ['Unable to delete the jar.', '无法删除储蓄罐。'],
    'Không tìm thấy khoản định kỳ.': ['Recurring item not found.', '未找到周期项目。'],
    'ID khoản định kỳ không hợp lệ.': ['Invalid recurring-item ID.', '周期项目 ID 无效。'],
    'Đã thêm khoản định kỳ!': ['Recurring item created.', '周期项目已创建！'],
    'Đã cập nhật khoản định kỳ!': ['Recurring item updated.', '周期项目已更新！'],
    'Lỗi khi tạo khoản định kỳ.': ['Unable to create the recurring item.', '无法创建周期项目。'],
    'Lỗi khi cập nhật khoản định kỳ.': ['Unable to update the recurring item.', '无法更新周期项目。'],
    'Lỗi khi xóa khoản định kỳ.': ['Unable to delete the recurring item.', '无法删除周期项目。'],
    'Không tìm thấy giao dịch hoặc bạn không có quyền chỉnh sửa.': ['Transaction not found or you cannot edit it.', '未找到交易，或您无权编辑。'],
    'Không tìm thấy giao dịch hoặc bạn không có quyền xóa.': ['Transaction not found or you cannot delete it.', '未找到交易，或您无权删除。'],
    'ID giao dịch không hợp lệ.': ['Invalid transaction ID.', '交易 ID 无效。'],
    'Đã lưu giao dịch!': ['Transaction saved.', '交易已保存！'],
    'Đã cập nhật giao dịch!': ['Transaction updated.', '交易已更新！'],
    'Đã xóa giao dịch thành công!': ['Transaction deleted.', '交易已删除！'],
    'Lỗi khi tải danh sách giao dịch.': ['Unable to load transactions.', '无法加载交易列表。'],
    'Lỗi khi tạo giao dịch.': ['Unable to create the transaction.', '无法创建交易。'],
    'Lỗi khi cập nhật giao dịch.': ['Unable to update the transaction.', '无法更新交易。'],
    'Lỗi khi xóa giao dịch.': ['Unable to delete the transaction.', '无法删除交易。'],
    'Kỳ ngân sách của tháng trước đã kết thúc. Không thể chỉnh sửa ngân sách quá khứ.': ['This past budget period is closed and cannot be edited.', '过去的预算周期已关闭，无法编辑。'],
    'Đã cập nhật hạn mức chi tiêu thành công!': ['Budget limits updated.', '预算限额已更新！'],
    'Lỗi khi tải ngân sách.': ['Unable to load budgets.', '无法加载预算。'],
    'Lỗi khi lưu hạn mức chi tiêu.': ['Unable to save budget limits.', '无法保存预算限额。'],
    'Tháng không hợp lệ.': ['Invalid month.', '月份无效。'],
    'Không thể tải các ngày đã xác nhận.': ['Unable to load expected days.', '无法加载已确认日期。'],
    'Ngày hoặc trạng thái không hợp lệ.': ['Invalid date or status.', '日期或状态无效。'],
    'Không thể lưu trạng thái ngày.': ['Unable to save day status.', '无法保存日期状态。'],
};

const remainingApiMessages = {
    'Số tiền nạp phải là số nguyên lớn hơn 0.': ['The deposit must be a whole number greater than zero.', '存入金额必须是大于零的整数。'],
    'Số tiền rút phải là số nguyên lớn hơn 0.': ['The withdrawal must be a whole number greater than zero.', '取出金额必须是大于零的整数。'],
    'Ví đã chọn không tồn tại hoặc không hợp lệ.': ['The selected wallet does not exist or is invalid.', '所选钱包不存在或无效。'],
    'Ví thanh toán đã chọn không tồn tại hoặc không hợp lệ.': ['The selected payment wallet does not exist or is invalid.', '所选付款钱包不存在或无效。'],
    'Đã xóa hũ và bảo toàn lịch sử giao dịch liên quan!': ['Jar deleted; related transaction history was preserved.', '已删除储蓄罐，相关交易记录已保留。'],
    'Lỗi khi lấy danh sách trả góp.': ['Unable to load recurring items.', '无法加载周期项目列表。'],
    'Danh mục khoản định kỳ không được để trống.': ['A recurring-item category is required.', '周期项目分类不能为空。'],
    'Danh mục không được để trống.': ['A category is required.', '分类不能为空。'],
    'Đã đánh dấu thanh toán và ghi nhận chi tiêu!': ['Payment marked and expense recorded.', '已标记付款并记录支出。'],
    'Lỗi khi cập nhật kỳ thanh toán.': ['Unable to update the payment period.', '无法更新付款周期。'],
    'Lỗi khi cập nhật trạng thái.': ['Unable to update the status.', '无法更新状态。'],
    'Đã xóa khoản định kỳ và bảo toàn lịch sử chi tiêu liên quan!': ['Recurring item deleted; related expense history was preserved.', '已删除周期项目，相关支出记录已保留。'],
    'Không tìm thấy user.': ['User not found.', '未找到用户。'],
    'Không tìm thấy tài khoản.': ['Account not found.', '未找到账户。'],
    'Không thể sao lưu dữ liệu.': ['Unable to back up data.', '无法备份数据。'],
    'Lỗi khi tải danh mục.': ['Unable to load categories.', '无法加载分类。'],
    'Dữ liệu danh mục không hợp lệ.': ['Invalid category data.', '分类数据无效。'],
    'Đã cập nhật danh mục thành công!': ['Categories updated.', '分类已更新！'],
    'Lỗi khi lưu danh mục.': ['Unable to save categories.', '无法保存分类。'],
    'Tháng ngân sách không hợp lệ.': ['Invalid budget month.', '预算月份无效。'],
    'Tên danh mục không hợp lệ.': ['Invalid category name.', '分类名称无效。'],
    'Giao dịch này thuộc về một Hũ tiết kiệm. Vào trang Hũ và dùng nút "Rút" để hoàn tác thay vì sửa trực tiếp ở đây.': ['This transaction belongs to a savings jar. Use Withdraw in Jars to reverse it instead of editing it here.', '此交易属于储蓄罐。请在储蓄罐页面使用“取出”撤销，而不要在此直接编辑。'],
    'Giao dịch này thuộc về một Khoản định kỳ. Vào trang Khoản định kỳ để chỉnh sửa thay vì sửa trực tiếp ở đây.': ['This transaction belongs to a recurring item. Edit it in Recurring items instead.', '此交易属于周期项目。请在周期项目页面编辑。'],
    'Giao dịch này thuộc về một Hũ tiết kiệm. Vào trang Hũ và dùng nút "Rút" để hoàn tác thay vì xóa trực tiếp ở đây.': ['This transaction belongs to a savings jar. Use Withdraw in Jars to reverse it instead of deleting it here.', '此交易属于储蓄罐。请在储蓄罐页面使用“取出”撤销，而不要在此直接删除。'],
    'Giao dịch này thuộc về một Khoản định kỳ. Vào trang Khoản định kỳ để chỉnh sửa thay vì xóa trực tiếp ở đây.': ['This transaction belongs to a recurring item. Edit it in Recurring items instead of deleting it here.', '此交易属于周期项目。请在周期项目页面编辑，而不要在此删除。'],
    'Đã xóa toàn bộ giao dịch, ngân sách, và đặt lại số dư hũ tiết kiệm, tiến độ khoản định kỳ về 0.': ['Transactions and budgets were deleted; jar balances and recurring progress were reset to zero.', '已删除所有交易与预算，并将储蓄罐余额和周期项目进度重置为零。'],
    'Lỗi server khi đặt lại dữ liệu chi tiêu.': ['Unable to reset spending data.', '无法重置支出数据。'],
    'Lỗi khi kiểm tra thông tin ví.': ['Unable to check wallet details.', '无法检查钱包信息。'],
    'Không tìm thấy ví hoặc ví đã được lưu trữ trước đó.': ['Wallet not found or already archived.', '未找到钱包，或钱包已归档。'],
    'Ví nhận số dư phải khác ví đang đóng.': ['The destination wallet must differ from the wallet being archived.', '接收余额的钱包不能是正在归档的钱包。'],
    'Ví nhận số dư không tồn tại hoặc đã bị lưu trữ.': ['The destination wallet does not exist or is archived.', '接收余额的钱包不存在或已归档。'],
    'Ví thay thế cho các khoản định kỳ phải khác ví đang đóng.': ['The replacement payment wallet must differ from the wallet being archived.', '替代付款钱包不能是正在归档的钱包。'],
    'Ví thay thế cho các khoản định kỳ không tồn tại hoặc đã bị lưu trữ.': ['The replacement payment wallet does not exist or is archived.', '替代付款钱包不存在或已归档。'],
    'Không tìm thấy ví đã lưu trữ.': ['Archived wallet not found.', '未找到已归档的钱包。'],
    'Lỗi khi tính số dư ví.': ['Unable to calculate wallet balances.', '无法计算钱包余额。'],
    'Đã xóa ví, bảo toàn số dư gốc và chuyển các giao dịch liên quan về ví mặc định!': ['Wallet deleted; its original balance was preserved and related transactions moved to the default wallet.', '已删除钱包，保留原始余额，并将相关交易移至默认钱包。'],
    'Không tìm thấy ví cần xóa.': ['Wallet to delete not found.', '未找到要删除的钱包。'],
    'Không tìm thấy ví thay thế hợp lệ.': ['No valid replacement wallet found.', '未找到有效的替代钱包。'],
    'Cần Idempotency-Key dạng UUID cho thao tác ghi.': ['A UUID Idempotency-Key is required for write operations.', '写入操作需要 UUID 格式的 Idempotency-Key。'],
};

const dictionaries = { ...common, ...auth, ...finance, ...remainingApiMessages };

function translateDynamic(message, locale) {
    const index = locale === 'en' ? 0 : 1;
    let match = message.match(/^Hạn mức cho danh mục "(.+)" (không hợp lệ\.|phải là số nguyên \(VNĐ không có phần thập phân\)\.|không được là số âm\.|vượt quá giới hạn tối đa cho phép \(100 tỷ VNĐ\)\.)$/);
    if (match) {
        const suffix = {
            'không hợp lệ.': ['is invalid.', '无效。'],
            'phải là số nguyên (VNĐ không có phần thập phân).': ['must be a whole VND amount.', '必须是 VND 整数。'],
            'không được là số âm.': ['cannot be negative.', '不能为负数。'],
            'vượt quá giới hạn tối đa cho phép (100 tỷ VNĐ).': ['exceeds the maximum of 100 billion VND.', '超过 1000 亿 VND 的上限。'],
        }[match[2]][index];
        return locale === 'en' ? `The limit for category "${match[1]}" ${suffix}` : `分类“${match[1]}”的限额${suffix}`;
    }
    match = message.match(/^Ví hiện đang có dư nợ \((.+)\)\./);
    if (match) return locale === 'en'
        ? `This wallet has an outstanding balance (${match[1]}). Pay it off before archiving the wallet.`
        : `此钱包仍有欠款（${match[1]}）。归档前请先还清欠款。`;
    match = message.match(/^Ví vẫn còn số dư \((.+)\)\./);
    if (match) return locale === 'en'
        ? `This wallet still has a balance (${match[1]}). Choose a destination wallet before archiving it.`
        : `此钱包仍有余额（${match[1]}）。归档前请选择接收余额的钱包。`;
    match = message.match(/^Ví đang liên kết với (\d+) khoản trả góp định kỳ\. Vui lòng chọn ví thanh toán thay thế\.$/);
    if (match) return locale === 'en'
        ? `This wallet is linked to ${match[1]} recurring items. Choose a replacement payment wallet.`
        : `此钱包关联 ${match[1]} 个周期项目。请选择替代付款钱包。`;
    match = message.match(/^Đã đóng và lưu trữ ví "(.+)" thành công!$/);
    if (match) return locale === 'en' ? `Wallet “${match[1]}” archived.` : `钱包“${match[1]}”已归档。`;
    match = message.match(/^Đã mở lại ví "(.+)"\.$/);
    if (match) return locale === 'en' ? `Wallet “${match[1]}” reopened.` : `钱包“${match[1]}”已重新启用。`;
    return null;
}

function translateMessage(locale, message, success = false) {
    if (!message || locale === 'vi') return message;
    const entry = dictionaries[message];
    if (entry) return entry[locale === 'en' ? 0 : 1];
    if (/[À-ỹ]/.test(message)) return translateDynamic(message, locale)
        || (success
            ? (locale === 'en' ? 'Request completed.' : '操作已完成。')
            : (locale === 'en' ? 'Unable to complete the request.' : '无法完成请求。'));
    return message;
}

function formatBaseCurrency(locale, amount) {
    const intlLocale = locale === 'en' ? 'en-US' : locale === 'zh-CN' ? 'zh-CN' : 'vi-VN';
    return new Intl.NumberFormat(intlLocale, {
        style: 'currency', currency: 'VND', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0
    }).format(amount);
}

function localizeApiResponse(req, res, next) {
    const locale = normalizeLocale(req.get('Accept-Language'));
    if (!supported.has(locale) || locale === 'vi') return next();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.message === 'string') {
            body = { ...body, message: translateMessage(locale, body.message, body.success === true) };
        }
        return originalJson(body);
    };
    return next();
}

module.exports = { normalizeLocale, translateMessage, localizeApiResponse, formatBaseCurrency };
