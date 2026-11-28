// Chính sách quyền riêng tư và Điều khoản sử dụng của CaltDHy (vi / en / zh-CN; ngôn ngữ khác dùng bản en).
// Khi thêm thu thập dữ liệu hoặc bên xử lý mới, cập nhật bản này và `updated`.
export const CONTACT_EMAIL = 'giahuyz3sta@gmail.com'; // điền email hỗ trợ để hiện mục liên hệ trên cả hai trang

const vi = {
  back: 'Quay lại', updatedLabel: 'Cập nhật lần cuối', otherDoc: { privacy: 'Xem Điều khoản sử dụng', terms: 'Xem Chính sách quyền riêng tư' },
  contactLabel: 'Liên hệ',
  privacy: {
    title: 'Chính sách', highlight: 'quyền riêng tư', updated: '16/11/2026',
    intro: 'CaltDHy là ứng dụng quản lý tài chính cá nhân. Trang này giải thích chúng tôi thu thập dữ liệu nào, dùng để làm gì và bạn kiểm soát nó ra sao.',
    sections: [
      { h: '1. Dữ liệu chúng tôi thu thập', list: [
        'Thông tin tài khoản: tên, email, mật khẩu (chỉ lưu dạng băm, không lưu mật khẩu gốc) và ảnh đại diện nếu bạn đặt.',
        'Dữ liệu tài chính bạn tự nhập: ví, giao dịch, hũ, ngân sách, khoản nợ, khoản định kỳ và các ghi chú đi kèm.',
        'Cài đặt và bảo mật: ngôn ngữ, tùy chọn nhắc nhở, khóa xác thực hai lớp, thông tin phiên đăng nhập và đăng ký thông báo đẩy nếu bạn bật.',
      ] },
      { h: '2. Đăng nhập bằng Google hoặc Facebook', p: [
        'Khi bạn chọn đăng nhập bằng Google, chúng tôi chỉ nhận tên, địa chỉ email, trạng thái xác minh email và mã định danh tài khoản Google (phạm vi openid, email, profile).',
        'Khi bạn chọn đăng nhập bằng Facebook, chúng tôi chỉ nhận tên, địa chỉ email và mã định danh tài khoản Facebook (quyền public_profile và email).',
        'Chúng tôi không đọc bạn bè, bài viết, ảnh, danh bạ hay bất kỳ dữ liệu nào khác trên Google hoặc Facebook, và không đăng gì thay bạn. Mã định danh chỉ dùng để nhận ra bạn ở lần đăng nhập sau. Bạn có thể gỡ liên kết trong Cài đặt → Dữ liệu & quyền riêng tư bất cứ lúc nào, miễn là còn một cách đăng nhập khác.',
      ] },
      { h: '3. Chúng tôi dùng dữ liệu để làm gì', list: [
        'Cung cấp ứng dụng: đăng nhập, lưu và hiển thị dữ liệu tài chính của bạn, thống kê và xuất dữ liệu.',
        'Bảo mật tài khoản: xác minh email, đặt lại mật khẩu, xác thực hai lớp, phát hiện đăng nhập bất thường.',
        'Gửi nhắc nhở bạn đã bật (email hoặc thông báo đẩy). Bạn có thể tạm dừng hoặc tắt trong Cài đặt hoặc ngay từ liên kết trong email.',
      ], p: ['Chúng tôi không bán dữ liệu của bạn, không dùng nó để quảng cáo và không chia sẻ cho bên thứ ba vì mục đích tiếp thị.'] },
      { h: '4. Bên xử lý dữ liệu', p: [
        'Để vận hành dịch vụ, dữ liệu được lưu và xử lý bởi các nhà cung cấp hạ tầng (máy chủ, cơ sở dữ liệu, gửi email) theo đúng mục đích vận hành. Chúng tôi chỉ chia sẻ dữ liệu khi pháp luật yêu cầu.',
      ] },
      { h: '5. Cookie và lưu trữ trên thiết bị', p: [
        'CaltDHy dùng cookie phiên đăng nhập (httpOnly) để giữ bạn đăng nhập và bảo vệ chống giả mạo yêu cầu, cùng bộ nhớ trình duyệt để nhớ ngôn ngữ và giao diện. Chúng tôi không dùng cookie quảng cáo hay công cụ theo dõi của bên thứ ba.',
      ] },
      { h: '6. Quyền của bạn và thời gian lưu trữ', list: [
        'Xem và sửa dữ liệu ngay trong ứng dụng; xuất dữ liệu giao dịch trong Cài đặt → Dữ liệu & quyền riêng tư.',
        'Gỡ liên kết Google hoặc Facebook, tắt nhắc nhở và đăng xuất khỏi các thiết bị bất cứ lúc nào.',
        'Yêu cầu xóa tài khoản và toàn bộ dữ liệu liên quan qua mục Liên hệ bên dưới. Chúng tôi giữ dữ liệu chừng nào tài khoản còn tồn tại và xóa sau khi xử lý yêu cầu của bạn.',
      ] },
      { h: '7. Trẻ em', p: ['CaltDHy không dành cho người dưới 13 tuổi và chúng tôi không cố ý thu thập dữ liệu của trẻ em.'] },
      { h: '8. Thay đổi chính sách', p: ['Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang. Thay đổi quan trọng sẽ được thông báo trong ứng dụng hoặc qua email.'] },
    ],
  },
  terms: {
    title: 'Điều khoản', highlight: 'sử dụng', updated: '16/11/2026',
    intro: 'Khi tạo tài khoản hoặc dùng CaltDHy, bạn đồng ý với các điều khoản dưới đây.',
    sections: [
      { h: '1. Dịch vụ', p: ['CaltDHy giúp bạn ghi chép thu chi và theo dõi tài chính cá nhân. Ứng dụng không phải là ngân hàng, không giữ hay chuyển tiền của bạn và không đưa ra tư vấn tài chính, đầu tư hay thuế.'] },
      { h: '2. Tài khoản', list: [
        'Bạn cần cung cấp thông tin chính xác và giữ bí mật mật khẩu cũng như các mã xác thực.',
        'Bạn chịu trách nhiệm cho hoạt động diễn ra dưới tài khoản của mình. Hãy báo cho chúng tôi nếu nghi ngờ bị truy cập trái phép.',
        'Nếu đăng nhập bằng Google hoặc Facebook, việc dùng các dịch vụ đó còn tuân theo điều khoản của họ.',
      ] },
      { h: '3. Sử dụng hợp lệ', p: ['Bạn không được dùng CaltDHy để vi phạm pháp luật, can thiệp hoặc làm gián đoạn dịch vụ, cố truy cập dữ liệu của người khác, hoặc tải lên nội dung độc hại.'] },
      { h: '4. Dữ liệu của bạn', p: ['Dữ liệu bạn nhập vẫn thuộc về bạn. Chúng tôi chỉ xử lý để cung cấp dịch vụ theo Chính sách quyền riêng tư. Hãy xuất dữ liệu để sao lưu khi cần.'] },
      { h: '5. Độ chính xác và giới hạn trách nhiệm', p: [
        'Các số liệu, biểu đồ và dự báo chỉ dựa trên dữ liệu bạn nhập và mang tính tham khảo. Dịch vụ được cung cấp “như hiện có”, có thể gián đoạn hoặc có lỗi. Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm cho tổn thất gián tiếp phát sinh từ việc dùng hoặc không thể dùng dịch vụ.',
      ] },
      { h: '6. Chấm dứt', p: ['Bạn có thể ngừng dùng dịch vụ và yêu cầu xóa tài khoản bất cứ lúc nào. Chúng tôi có thể tạm khóa hoặc đóng tài khoản vi phạm điều khoản này.'] },
      { h: '7. Thay đổi điều khoản', p: ['Chúng tôi có thể cập nhật điều khoản này. Việc tiếp tục dùng CaltDHy sau khi thay đổi có hiệu lực nghĩa là bạn chấp nhận bản mới.'] },
    ],
  },
};

const en = {
  back: 'Back', updatedLabel: 'Last updated', otherDoc: { privacy: 'View Terms of Service', terms: 'View Privacy Policy' },
  contactLabel: 'Contact',
  privacy: {
    title: 'Privacy', highlight: 'policy', updated: 'November 16, 2026',
    intro: 'CaltDHy is a personal finance app. This page explains what data we collect, what we use it for and how you stay in control.',
    sections: [
      { h: '1. Data we collect', list: [
        'Account details: name, email, password (stored only as a hash, never in plain text) and a profile picture if you set one.',
        'Financial data you enter yourself: wallets, transactions, jars, budgets, debts, recurring items and attached notes.',
        'Settings and security: language, reminder preferences, two-factor secrets, sign-in sessions and push subscriptions if you turn them on.',
      ] },
      { h: '2. Signing in with Google or Facebook', p: [
        'If you sign in with Google, we receive only your name, email address, whether the email is verified and your Google account ID (the openid, email and profile scopes).',
        'If you sign in with Facebook, we receive only your name, email address and Facebook account ID (the public_profile and email permissions).',
        'We do not read your friends, posts, photos, contacts or any other Google or Facebook data, and we never post on your behalf. The ID is used only to recognise you next time. You can unlink either provider at any time in Settings → Data & privacy, as long as another sign-in method remains.',
      ] },
      { h: '3. What we use it for', list: [
        'Running the app: signing you in, storing and showing your finances, statistics and exports.',
        'Protecting your account: email verification, password reset, two-factor sign-in and spotting unusual sign-ins.',
        'Sending reminders you turned on (email or push). Pause or switch them off in Settings or from the link in any email.',
      ], p: ['We do not sell your data, use it for advertising or share it with third parties for marketing.'] },
      { h: '4. Service providers', p: [
        'To run the service, data is stored and processed by infrastructure providers (hosting, database, email delivery) solely for that purpose. We disclose data otherwise only when the law requires it.',
      ] },
      { h: '5. Cookies and on-device storage', p: [
        'CaltDHy uses an httpOnly session cookie to keep you signed in and guard against request forgery, plus browser storage to remember your language and theme. We use no advertising cookies or third-party trackers.',
      ] },
      { h: '6. Your rights and retention', list: [
        'View and edit your data in the app, and export your transactions in Settings → Data & privacy.',
        'Unlink Google or Facebook, turn reminders off and sign out of devices at any time.',
        'Ask us to delete your account and all related data using the Contact section below. We keep data while your account exists and delete it after handling your request.',
      ] },
      { h: '7. Children', p: ['CaltDHy is not for children under 13 and we do not knowingly collect their data.'] },
      { h: '8. Changes', p: ['When this policy changes we update the date above. Significant changes are announced in the app or by email.'] },
    ],
  },
  terms: {
    title: 'Terms of', highlight: 'service', updated: 'November 16, 2026',
    intro: 'By creating an account or using CaltDHy you agree to the terms below.',
    sections: [
      { h: '1. The service', p: ['CaltDHy helps you record income and spending and track your personal finances. It is not a bank, does not hold or move your money and does not give financial, investment or tax advice.'] },
      { h: '2. Your account', list: [
        'Provide accurate information and keep your password and authentication codes secret.',
        'You are responsible for activity under your account. Tell us if you suspect unauthorised access.',
        'If you sign in with Google or Facebook, those services’ own terms also apply.',
      ] },
      { h: '3. Acceptable use', p: ['Do not use CaltDHy to break the law, interfere with or disrupt the service, try to access other people’s data or upload harmful content.'] },
      { h: '4. Your data', p: ['The data you enter remains yours. We process it only to provide the service, as described in the Privacy Policy. Export your data to keep a backup when you need one.'] },
      { h: '5. Accuracy and liability', p: [
        'Figures, charts and forecasts rely on the data you enter and are for reference only. The service is provided “as is” and may be interrupted or contain errors. To the extent the law allows, we are not liable for indirect losses arising from using or being unable to use the service.',
      ] },
      { h: '6. Ending use', p: ['You may stop using the service and ask us to delete your account at any time. We may suspend or close accounts that breach these terms.'] },
      { h: '7. Changes', p: ['We may update these terms. Continuing to use CaltDHy after a change takes effect means you accept the new version.'] },
    ],
  },
};

// Bản zh-CN dịch từ bản en; nếu sửa nội dung, sửa cả ba bản.
const zhCN = {
  back: '返回', updatedLabel: '最后更新', otherDoc: { privacy: '查看使用条款', terms: '查看隐私政策' },
  contactLabel: '联系我们',
  privacy: {
    title: '隐私政策', highlight: '', updated: '2026 年 11 月 16 日',
    intro: 'CaltDHy 是一款个人财务管理应用。本页说明我们收集哪些数据、用于什么目的，以及你如何掌控这些数据。',
    sections: [
      { h: '1. 我们收集的数据', list: [
        '账户信息：姓名、邮箱、密码（仅以哈希形式保存，从不保存明文）以及你设置的头像。',
        '你自行录入的财务数据：钱包、交易、储蓄罐、预算、借贷记录、周期项目及相关备注。',
        '设置与安全：语言、提醒偏好、两步验证密钥、登录会话，以及你开启后的推送订阅。',
      ] },
      { h: '2. 使用 Google 或 Facebook 登录', p: [
        '使用 Google 登录时，我们只接收你的姓名、邮箱地址、邮箱是否已验证以及 Google 账户 ID（openid、email 和 profile 范围）。',
        '使用 Facebook 登录时，我们只接收你的姓名、邮箱地址以及 Facebook 账户 ID（public_profile 和 email 权限）。',
        '我们不会读取你的好友、帖子、照片、通讯录或任何其他 Google / Facebook 数据，也绝不会代你发布内容。账户 ID 仅用于下次识别你的身份。只要还保留另一种登录方式，你可以随时在“设置 → 数据与隐私”中解除关联。',
      ] },
      { h: '3. 我们如何使用这些数据', list: [
        '提供应用功能：登录、保存并展示你的财务数据、统计与导出。',
        '保护你的账户：邮箱验证、重置密码、两步验证以及发现异常登录。',
        '发送你开启的提醒（邮件或推送）。你可以在设置中或通过任意邮件中的链接暂停或关闭提醒。',
      ], p: ['我们不会出售你的数据，不会将其用于广告，也不会为营销目的与第三方共享。'] },
      { h: '4. 服务提供方', p: [
        '为运行本服务，数据由基础设施提供方（服务器托管、数据库、邮件发送）存储和处理，且仅用于此目的。除法律要求外，我们不会以其他方式披露数据。',
      ] },
      { h: '5. Cookie 与设备本地存储', p: [
        'CaltDHy 使用 httpOnly 会话 Cookie 保持你的登录状态并防范跨站请求伪造，同时使用浏览器存储记住你的语言与主题。我们不使用广告 Cookie 或第三方追踪器。',
      ] },
      { h: '6. 你的权利与数据保留', list: [
        '在应用中查看和编辑你的数据，并在“设置 → 数据与隐私”中导出交易记录。',
        '随时解除 Google 或 Facebook 关联、关闭提醒并退出各设备上的登录。',
        '可通过下方联系方式要求删除你的账户及全部相关数据。账户存续期间我们会保留数据，处理你的请求后即予以删除。',
      ] },
      { h: '7. 儿童', p: ['CaltDHy 不面向 13 岁以下儿童，我们也不会有意收集其数据。'] },
      { h: '8. 政策变更', p: ['本政策变更时，我们会更新上方日期。重大变更将通过应用内或邮件通知。'] },
    ],
  },
  terms: {
    title: '使用条款', highlight: '', updated: '2026 年 11 月 16 日',
    intro: '创建账户或使用 CaltDHy，即表示你同意以下条款。',
    sections: [
      { h: '1. 服务内容', p: ['CaltDHy 帮助你记录收入与支出、跟踪个人财务。它不是银行，不持有也不转移你的资金，也不提供财务、投资或税务建议。'] },
      { h: '2. 你的账户', list: [
        '请提供真实信息，并妥善保管你的密码和验证码。',
        '你需对账户下的所有活动负责。如怀疑账户被未经授权访问，请告知我们。',
        '如果你使用 Google 或 Facebook 登录，这些服务自身的条款同样适用。',
      ] },
      { h: '3. 合理使用', p: ['请勿利用 CaltDHy 从事违法活动、干扰或破坏服务、试图访问他人数据或上传有害内容。'] },
      { h: '4. 你的数据', p: ['你录入的数据始终归你所有。我们仅为提供服务而处理这些数据，具体见隐私政策。需要备份时，请导出你的数据。'] },
      { h: '5. 准确性与责任', p: [
        '数字、图表与预测基于你录入的数据，仅供参考。本服务按“现状”提供，可能出现中断或错误。在法律允许的范围内，我们不对因使用或无法使用本服务而产生的间接损失承担责任。',
      ] },
      { h: '6. 停止使用', p: ['你可以随时停止使用本服务并要求删除账户。对于违反本条款的账户，我们可能暂停或关闭。'] },
      { h: '7. 条款变更', p: ['我们可能更新本条款。变更生效后继续使用 CaltDHy，即表示你接受新版本。'] },
    ],
  },
};

export const LEGAL_COPY = { vi, en, 'zh-CN': zhCN };
