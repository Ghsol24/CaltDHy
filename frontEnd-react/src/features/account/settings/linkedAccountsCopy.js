// Text for Settings > Data & privacy > Linked accounts.
const NAMES = { google: 'Google', facebook: 'Facebook' };
const COPY = {
  vi: {
    title: 'Tài khoản liên kết',
    intro: 'Liên kết Google hoặc Facebook để đăng nhập CaltDHy bằng tài khoản đó. Gỡ liên kết không xóa dữ liệu của bạn.',
    linked: 'Đã liên kết', notLinked: 'Chưa liên kết',
    link: 'Liên kết', unlink: 'Gỡ liên kết', cancel: 'Hủy', loading: 'Đang tải…', none: 'Chưa có cách đăng nhập ngoài nào được bật.',
    password: 'Mật khẩu hiện tại',
    confirmLink: (p) => `Tiếp tục tới ${NAMES[p]}`, confirmUnlink: (p) => `Gỡ ${NAMES[p]}`,
    linkHint: (p) => `Nhập mật khẩu CaltDHy để xác nhận. Sau đó bạn sẽ được chuyển sang ${NAMES[p]} để đăng nhập.`,
    linkHintNoPassword: (p) => `Bạn sẽ được chuyển sang ${NAMES[p]} để đăng nhập, rồi quay lại đây.`,
    unlinkHint: (p) => `Nhập mật khẩu CaltDHy để gỡ ${NAMES[p]}. Sau khi gỡ, bạn không đăng nhập bằng ${NAMES[p]} được nữa.`,
    unlinkHintNoPassword: (p) => `Sau khi gỡ, bạn không đăng nhập bằng ${NAMES[p]} được nữa.`,
    lastMethod: 'Đây là cách đăng nhập duy nhất của tài khoản. Hãy tạo mật khẩu trong mục Bảo mật trước khi gỡ.',
    leaving: (p) => `Đang chuyển sang ${NAMES[p]}…`,
    done: (p) => `Đã liên kết ${NAMES[p]}. Lần sau bạn có thể đăng nhập bằng ${NAMES[p]}.`,
    unlinked: (p) => `Đã gỡ liên kết ${NAMES[p]}.`,
    needPassword: 'Nhập mật khẩu hiện tại để tiếp tục.',
    failed: 'Chưa thực hiện được. Vui lòng thử lại.',
    errors: {
      in_use: (p) => `Tài khoản ${NAMES[p]} này đã liên kết với một tài khoản CaltDHy khác.`,
      already: (p) => `Tài khoản đang liên kết với một tài khoản ${NAMES[p]} khác. Hãy gỡ liên kết cũ trước.`,
      expired: () => 'Phiên liên kết đã hết hạn hoặc bạn vừa đăng nhập lại. Hãy thử lại.',
      cancelled: (p) => `Bạn đã hủy liên kết ${NAMES[p]}. Chưa có gì thay đổi.`,
      unavailable: () => 'Cách đăng nhập này hiện chưa được bật.',
      failed: (p) => `Chưa liên kết được ${NAMES[p]}. Vui lòng thử lại.`,
    },
  },
  en: {
    title: 'Linked accounts',
    intro: 'Link Google or Facebook to sign in to CaltDHy with that account. Unlinking does not delete any of your data.',
    linked: 'Linked', notLinked: 'Not linked',
    link: 'Link', unlink: 'Unlink', cancel: 'Cancel', loading: 'Loading…', none: 'No outside sign-in option is turned on yet.',
    password: 'Current password',
    confirmLink: (p) => `Continue to ${NAMES[p]}`, confirmUnlink: (p) => `Unlink ${NAMES[p]}`,
    linkHint: (p) => `Enter your CaltDHy password to confirm. You will then go to ${NAMES[p]} to sign in.`,
    linkHintNoPassword: (p) => `You will go to ${NAMES[p]} to sign in, then come back here.`,
    unlinkHint: (p) => `Enter your CaltDHy password to unlink ${NAMES[p]}. Afterwards you can no longer sign in with ${NAMES[p]}.`,
    unlinkHintNoPassword: (p) => `Afterwards you can no longer sign in with ${NAMES[p]}.`,
    lastMethod: 'This is your only way to sign in. Create a password under Security before unlinking it.',
    leaving: (p) => `Opening ${NAMES[p]}…`,
    done: (p) => `${NAMES[p]} is linked. Next time you can sign in with ${NAMES[p]}.`,
    unlinked: (p) => `${NAMES[p]} has been unlinked.`,
    needPassword: 'Enter your current password to continue.',
    failed: 'That did not work. Please try again.',
    errors: {
      in_use: (p) => `This ${NAMES[p]} account is already linked to another CaltDHy account.`,
      already: (p) => `Your account is linked to a different ${NAMES[p]} account. Unlink that one first.`,
      expired: () => 'The linking step expired or you signed in again. Please try again.',
      cancelled: (p) => `You cancelled linking ${NAMES[p]}. Nothing was changed.`,
      unavailable: () => 'This sign-in option is not turned on yet.',
      failed: (p) => `${NAMES[p]} could not be linked. Please try again.`,
    },
  },
  'zh-CN': {
    title: '关联账户',
    intro: '关联 Google 或 Facebook 后，可使用该账户登录 CaltDHy。解除关联不会删除您的任何数据。',
    linked: '已关联', notLinked: '未关联',
    link: '关联', unlink: '解除关联', cancel: '取消', loading: '正在加载…', none: '尚未启用任何外部登录方式。',
    password: '当前密码',
    confirmLink: (p) => `前往 ${NAMES[p]}`, confirmUnlink: (p) => `解除关联 ${NAMES[p]}`,
    linkHint: (p) => `请输入 CaltDHy 密码以确认，随后将前往 ${NAMES[p]} 登录。`,
    linkHintNoPassword: (p) => `您将前往 ${NAMES[p]} 登录，然后返回此处。`,
    unlinkHint: (p) => `请输入 CaltDHy 密码以解除关联 ${NAMES[p]}。解除后将无法再使用 ${NAMES[p]} 登录。`,
    unlinkHintNoPassword: (p) => `解除后将无法再使用 ${NAMES[p]} 登录。`,
    lastMethod: '这是您唯一的登录方式。请先在“安全”中创建密码，再解除关联。',
    leaving: (p) => `正在前往 ${NAMES[p]}…`,
    done: (p) => `已关联 ${NAMES[p]}。下次可使用 ${NAMES[p]} 登录。`,
    unlinked: (p) => `已解除关联 ${NAMES[p]}。`,
    needPassword: '请输入当前密码以继续。',
    failed: '操作未成功，请重试。',
    errors: {
      in_use: (p) => `此 ${NAMES[p]} 账户已关联到另一个 CaltDHy 账户。`,
      already: (p) => `您的账户已关联另一个 ${NAMES[p]} 账户。请先解除原有关联。`,
      expired: () => '关联步骤已过期，或您刚刚重新登录。请重试。',
      cancelled: (p) => `您已取消关联 ${NAMES[p]}，未作任何更改。`,
      unavailable: () => '此登录方式尚未启用。',
      failed: (p) => `无法关联 ${NAMES[p]}，请重试。`,
    },
  },
};

export const PROVIDER_NAMES = NAMES;
export function getLinkedAccountsCopy(lang) {
  return COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
}
/** Reviewed text for the code the server puts in ?link_error=; unknown codes get the generic message. */
export function linkErrorText(copy, code, provider) {
  const entry = Object.prototype.hasOwnProperty.call(copy.errors, code) ? copy.errors[code] : copy.errors.failed;
  return entry(provider);
}
