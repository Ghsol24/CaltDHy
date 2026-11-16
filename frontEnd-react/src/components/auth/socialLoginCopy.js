// Text for "Continue with Google / Facebook" and the confirmation step that follows it.
const NAMES = { google: 'Google', facebook: 'Facebook' };
const COPY = {
  vi: {
    continueWith: (provider) => `Tiếp tục với ${NAMES[provider]}`,
    leaving: (provider) => `Đang chuyển sang ${NAMES[provider]}…`,
    finishing: 'Đang hoàn tất đăng nhập…',
    linkTitle: 'Liên kết', linkHighlight: 'tài khoản',
    linkBody: (provider, email) => `Email ${email} đã có tài khoản CaltDHy. Để dùng ${NAMES[provider]} đăng nhập vào tài khoản đó, hãy nhập mật khẩu CaltDHy của bạn. Chưa có gì thay đổi cho tới khi bạn xác nhận.`,
    verifyTitle: 'Xác thực', verifyHighlight: 'hai lớp',
    verifyBody: (provider, email) => `${NAMES[provider]} đã xác nhận ${email}. Tài khoản này bật xác thực hai lớp, hãy nhập mã để hoàn tất đăng nhập.`,
    password: 'Mật khẩu CaltDHy', code: 'Mã 6 số hoặc mã khôi phục',
    codeHint: 'Mở ứng dụng xác thực để lấy mã. Mất điện thoại? Nhập một mã khôi phục.',
    confirmLink: 'Liên kết và đăng nhập', confirmVerify: 'Đăng nhập', working: 'Đang xác nhận…',
    cancel: 'Hủy và quay lại đăng nhập', backToLogin: 'Quay lại đăng nhập', loading: 'Đang kiểm tra…',
    needPassword: 'Nhập mật khẩu CaltDHy để tiếp tục.', needCode: 'Nhập mã 6 số từ ứng dụng xác thực để tiếp tục.',
    expired: 'Bước xác nhận đã hết hạn. Hãy đăng nhập lại bằng Google hoặc Facebook.',
    errors: {
      unavailable: 'Cách đăng nhập này hiện chưa được bật.',
      cancelled: 'Bạn đã hủy đăng nhập. Chưa có gì thay đổi.',
      failed: 'Chưa đăng nhập được bằng tài khoản đó. Vui lòng thử lại.',
      no_email: 'Tài khoản Facebook này không chia sẻ email nên chưa thể tạo tài khoản CaltDHy. Hãy cho phép chia sẻ email hoặc dùng cách đăng nhập khác.',
      email_unverified: 'Email của tài khoản Google này chưa được xác minh. Hãy xác minh email với Google rồi thử lại.',
      use_google: 'Email này đã có tài khoản CaltDHy đăng nhập bằng Google. Hãy tiếp tục với Google.',
      use_facebook: 'Email này đã có tài khoản CaltDHy đăng nhập bằng Facebook. Hãy tiếp tục với Facebook.',
      invite_required: 'Cần liên kết mời dành cho đúng email này để tạo tài khoản mới.',
    },
  },
  en: {
    continueWith: (provider) => `Continue with ${NAMES[provider]}`,
    leaving: (provider) => `Opening ${NAMES[provider]}…`,
    finishing: 'Finishing sign-in…',
    linkTitle: 'Link your', linkHighlight: 'account',
    linkBody: (provider, email) => `${email} already has a CaltDHy account. To sign in to it with ${NAMES[provider]}, enter your CaltDHy password. Nothing changes until you confirm.`,
    verifyTitle: 'Two-factor', verifyHighlight: 'sign-in',
    verifyBody: (provider, email) => `${NAMES[provider]} confirmed ${email}. This account uses two-factor sign-in, so enter a code to finish.`,
    password: 'CaltDHy password', code: '6-digit code or recovery code',
    codeHint: 'Open your authenticator app for the code. Lost your phone? Enter a recovery code.',
    confirmLink: 'Link and sign in', confirmVerify: 'Sign in', working: 'Confirming…',
    cancel: 'Cancel and go back to login', backToLogin: 'Back to login', loading: 'Checking…',
    needPassword: 'Enter your CaltDHy password to continue.', needCode: 'Enter the 6-digit code from your authenticator app to continue.',
    expired: 'This confirmation step has expired. Please sign in with Google or Facebook again.',
    errors: {
      unavailable: 'This sign-in option is not turned on yet.',
      cancelled: 'You cancelled the sign-in. Nothing was changed.',
      failed: 'We could not sign you in with that account. Please try again.',
      no_email: 'This Facebook account does not share an email, so a CaltDHy account cannot be created. Allow email sharing or use another sign-in option.',
      email_unverified: 'The email on this Google account is not verified. Verify it with Google, then try again.',
      use_google: 'This email already has a CaltDHy account that signs in with Google. Continue with Google instead.',
      use_facebook: 'This email already has a CaltDHy account that signs in with Facebook. Continue with Facebook instead.',
      invite_required: 'A new account needs an invitation link for this exact email.',
    },
  },
  'zh-CN': {
    continueWith: (provider) => `使用 ${NAMES[provider]} 继续`,
    leaving: (provider) => `正在前往 ${NAMES[provider]}…`,
    finishing: '正在完成登录…',
    linkTitle: '关联', linkHighlight: '账户',
    linkBody: (provider, email) => `${email} 已有 CaltDHy 账户。如需使用 ${NAMES[provider]} 登录该账户，请输入您的 CaltDHy 密码。在您确认之前不会有任何更改。`,
    verifyTitle: '两步', verifyHighlight: '验证',
    verifyBody: (provider, email) => `${NAMES[provider]} 已确认 ${email}。此账户已开启两步验证，请输入验证码以完成登录。`,
    password: 'CaltDHy 密码', code: '6 位验证码或恢复代码',
    codeHint: '请打开身份验证器应用获取验证码。手机丢失？请输入恢复代码。',
    confirmLink: '关联并登录', confirmVerify: '登录', working: '正在确认…',
    cancel: '取消并返回登录', backToLogin: '返回登录', loading: '正在检查…',
    needPassword: '请输入 CaltDHy 密码以继续。', needCode: '请输入身份验证器应用中的 6 位验证码以继续。',
    expired: '确认步骤已过期。请重新使用 Google 或 Facebook 登录。',
    errors: {
      unavailable: '此登录方式尚未启用。',
      cancelled: '您已取消登录，未作任何更改。',
      failed: '无法使用该账户登录，请重试。',
      no_email: '此 Facebook 账户未共享电子邮件，因此无法创建 CaltDHy 账户。请允许共享电子邮件或改用其他登录方式。',
      email_unverified: '此 Google 账户的电子邮件尚未验证。请先在 Google 完成验证后再试。',
      use_google: '此电子邮件已有使用 Google 登录的 CaltDHy 账户，请使用 Google 继续。',
      use_facebook: '此电子邮件已有使用 Facebook 登录的 CaltDHy 账户，请使用 Facebook 继续。',
      invite_required: '创建新账户需要针对此电子邮件的邀请链接。',
    },
  },
};

export function getSocialCopy(lang) {
  return COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
}

/** Maps the short code the server appends to /login into reviewed text; unknown codes get the generic message. */
export function socialErrorText(copy, code) {
  return Object.prototype.hasOwnProperty.call(copy.errors, code) ? copy.errors[code] : copy.errors.failed;
}
