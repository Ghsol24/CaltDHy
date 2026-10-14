const copy = {
  vi: {
    overview: 'Tổng quan kế hoạch',
    create: 'Lập kế hoạch',
    mobileOverview: 'Kế hoạch',
    mobileCreate: 'Lập mới',
    attention: 'Cần chú ý',
    alertCount: (count) => `${count} việc cần lưu ý`,
    moreAlerts: (count) => `Xem thêm ${count} việc`,
    collapse: 'Thu gọn',
  },
  en: {
    overview: 'Plan overview',
    create: 'Create plan',
    mobileOverview: 'Plan',
    mobileCreate: 'Create',
    attention: 'Needs attention',
    alertCount: (count) => `${count} item${count === 1 ? '' : 's'} to review`,
    moreAlerts: (count) => `Show ${count} more`,
    collapse: 'Show less',
  },
  'zh-CN': {
    overview: '计划概览',
    create: '创建计划',
    mobileOverview: '计划',
    mobileCreate: '创建',
    attention: '需要关注',
    alertCount: (count) => `${count} 项需要关注`,
    moreAlerts: (count) => `再显示 ${count} 项`,
    collapse: '收起',
  },
};

export const getPlanCopy = (locale) => copy[locale] || copy.vi;
