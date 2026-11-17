// Home headline strings, used only by the home screen (loaded on demand). Registered here,
// not in translations.js, so they stay out of the initial bundle; HomeView imports this file.
import { registerTranslations } from './translations';

registerTranslations({
  vi: {
    'home.greetingStart': 'Chào bạn, hãy bắt đầu quản lý tài chính {month}',
    'home.statusOver': '{count} danh mục vượt hạn mức',
    'home.statusNear': '{count} danh mục sắp chạm hạn mức',
  },
  en: {
    'home.greetingStart': 'Welcome — start managing your {month} finances',
    'home.statusOver': '{count} over limit',
    'home.statusNear': '{count} near limit',
  },
  'zh-CN': {
    'home.greetingStart': '欢迎，开始管理{month}财务吧',
    'home.statusOver': '{count} 项超出限额',
    'home.statusNear': '{count} 项接近限额',
  },
});
