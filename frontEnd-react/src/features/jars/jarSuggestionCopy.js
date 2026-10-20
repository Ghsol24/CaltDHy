const positiveAmount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;

// Suggest the next real milestone. Display rounding never decides which milestone is next.
export function buildJarSuggestions(jars = []) {
  const entries = (Array.isArray(jars) ? jars : []).filter(Boolean).map(jar => {
    const current = positiveAmount(jar.current);
    const target = positiveAmount(jar.target);
    const progress = target > 0 ? Math.min(100, current / target * 100) : 0;
    if (!target) return { kind: 'no-target', jar, current, target, progress };
    if (current >= target) return { kind: 'complete', jar, current, target, progress: 100 };
    const nextMilestone = [25, 50, 75, 100].find(milestone => current < target * milestone / 100) || 100;
    const amount = Math.max(1, Math.ceil(target * nextMilestone / 100 - current));
    return { kind: 'milestone', jar, current, target, progress, nextMilestone, amount };
  });
  const milestones = entries.filter(item => item.kind === 'milestone').sort((a, b) => b.progress - a.progress);
  const others = entries.filter(item => item.kind !== 'milestone');
  const suggestions = [...milestones, ...others];
  return suggestions.length ? suggestions : [{ kind: 'empty', jar: null, current: 0, target: 0, progress: 0 }];
}

const COPY = {
  vi: {
    nextStep: 'Bước tiếp theo', another: 'Gợi ý khác',
    milestone: percent => `Mốc kế tiếp: ${percent}`,
    amountNeeded: 'Cần nạp thêm', deposit: amount => `Nạp ${amount} vào hũ`,
    saved: 'Đã có', target: 'Mục tiêu', noTarget: 'Chưa đặt mục tiêu',
    splitEven: amount => `Chia nhỏ: 2 lần × ${amount}.`,
    splitUneven: (first, second) => `Chia nhỏ: ${first} + ${second}.`,
    confirmNext: 'Chọn ví và xác nhận ở bước tiếp theo.',
    completeTitle: 'Đã đạt mục tiêu', completeText: 'Khoản tích lũy đã đủ mục tiêu. Bạn có thể giữ tiền trong hũ hoặc đặt mục tiêu mới.',
    createNext: 'Tạo mục tiêu tiếp theo',
    noTargetTitle: 'Đặt một mốc để theo dõi', noTargetText: 'Thêm số tiền mục tiêu để xem tiến độ và khoản cần tích lũy tiếp theo.',
    editTarget: 'Đặt mục tiêu cho hũ',
    emptyTitle: 'Bắt đầu với một hũ', emptyText: 'Chọn tên và số tiền mục tiêu. Bạn có thể nạp tiền sau khi tạo hũ.',
    createFirst: 'Tạo hũ đầu tiên',
    progressLabel: name => `Tiến độ hũ ${name}`,
  },
  en: {
    nextStep: 'Next step', another: 'Another idea',
    milestone: percent => `Next milestone: ${percent}`,
    amountNeeded: 'Amount to add', deposit: amount => `Add ${amount} to jar`,
    saved: 'Saved', target: 'Goal', noTarget: 'No goal set',
    splitEven: amount => `Break it down: 2 deposits of ${amount}.`,
    splitUneven: (first, second) => `Break it down: ${first} + ${second}.`,
    confirmNext: 'Choose a wallet and confirm in the next step.',
    completeTitle: 'Goal reached', completeText: 'You have saved enough for this goal. Keep the money here or set a new goal.',
    createNext: 'Create your next goal',
    noTargetTitle: 'Set a goal to track', noTargetText: 'Add a target amount to see your progress and the next amount to save.',
    editTarget: 'Set a goal for this jar',
    emptyTitle: 'Start with one jar', emptyText: 'Choose a name and target amount. You can add money after creating the jar.',
    createFirst: 'Create your first jar',
    progressLabel: name => `Progress for ${name}`,
  },
  'zh-CN': {
    nextStep: '下一步', another: '换个建议',
    milestone: percent => `下一个里程碑：${percent}`,
    amountNeeded: '还需存入', deposit: amount => `存入 ${amount}`,
    saved: '已存', target: '目标', noTarget: '尚未设置目标',
    splitEven: amount => `分两次存入，每次 ${amount}。`,
    splitUneven: (first, second) => `分两次存入：${first} + ${second}。`,
    confirmNext: '下一步选择钱包并确认。',
    completeTitle: '目标已达成', completeText: '储蓄已达到目标。可以保留这笔钱，也可以设置新目标。',
    createNext: '创建下一个目标',
    noTargetTitle: '设置一个可追踪的目标', noTargetText: '填写目标金额，即可查看进度和下一步需储蓄的金额。',
    editTarget: '设置此储蓄罐的目标',
    emptyTitle: '从一个储蓄罐开始', emptyText: '选择名称和目标金额。创建后再存入资金。',
    createFirst: '创建第一个储蓄罐',
    progressLabel: name => `${name}的储蓄进度`,
  },
};

export const getJarSuggestionCopy = lang => COPY[lang] || COPY.vi;
