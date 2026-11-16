// Home headline templates, used only by the home screen (loaded on demand). Registered here,
// not in translations.js, so they stay out of the initial bundle; HomeView imports this file.
import { registerTranslations } from './translations';

registerTranslations({
  vi: {
    'home.greetingOkay': '{Month} đang ổn',
    'home.greetingStart': 'Chào bạn, hãy bắt đầu quản lý tài chính {month}',
    'home.greetingReady': 'Kế hoạch chi tiêu {month} đã sẵn sàng',
    'home.greetingOver': '{Month}: có khoản vượt hạn mức',
    'home.greetingWarning': 'Chi tiêu {month} cần chú ý',
    'home.greetingSummary': 'Tổng quan chi tiêu {month}',
    'home.greetingGrowing': 'Thu nhập {month} cao hơn chi tiêu',
    'home.greetingControlled': 'Chi tiêu {month} trong tầm kiểm soát',
  },
  en: {
    'home.greetingOkay': '{Month} looks fine',
    'home.greetingStart': 'Welcome — start managing your {month} finances',
    'home.greetingReady': 'Your {month} spending plan is ready',
    'home.greetingOver': '{Month}: a category is over its limit',
    'home.greetingWarning': 'Your {month} spending needs attention',
    'home.greetingSummary': '{Month} spending overview',
    'home.greetingGrowing': 'Income is ahead of spending in {month}',
    'home.greetingControlled': '{Month} spending is under control',
  },
  'zh-CN': {
    'home.greetingOkay': '您的{month}财务状况良好',
    'home.greetingStart': '欢迎，开始管理{month}财务吧',
    'home.greetingReady': '{month}支出计划已准备就绪',
    'home.greetingOver': '{month}有分类已超出限额',
    'home.greetingWarning': '{month}支出需要关注',
    'home.greetingSummary': '{month}支出总览',
    'home.greetingGrowing': '{month}收入高于支出',
    'home.greetingControlled': '{month}支出在控制范围内',
  },
});
