export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Transportation', icon: '🚗' },
  { name: 'Housing & Bills', icon: '🏠' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Health & Beauty', icon: '💊' },
  { name: 'Education', icon: '📚' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Other Expense', icon: '📦' }
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: '💼' },
  { name: 'Business', icon: '📈' },
  { name: 'Investment', icon: '💰' },
  { name: 'Gift & Bonus', icon: '🎁' },
  { name: 'Other Income', icon: '💵' }
];

export const getCategoryIcon = (categoryName, type = 'expense') => {
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
  const found = all.find((c) => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  if (found) return found.icon;
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('ăn') || lower.includes('food') || lower.includes('uống') || lower.includes('cà phê') || lower.includes('dining')) return '🍔';
  if (lower.includes('mua') || lower.includes('shop')) return '🛍️';
  if (lower.includes('xe') || lower.includes('xăng') || lower.includes('đi lại') || lower.includes('transport')) return '🚗';
  if (lower.includes('nhà') || lower.includes('bill') || lower.includes('điện') || lower.includes('nước') || lower.includes('housing')) return '🏠';
  if (lower.includes('sức khỏe') || lower.includes('thuốc') || lower.includes('health') || lower.includes('beauty') || lower.includes('y tế')) return '💊';
  if (lower.includes('học') || lower.includes('sách') || lower.includes('edu')) return '📚';
  if (lower.includes('chơi') || lower.includes('game') || lower.includes('phim') || lower.includes('entertain')) return '🎬';
  if (lower.includes('lương') || lower.includes('salary')) return '💼';
  if (lower.includes('kinh doanh') || lower.includes('business')) return '📈';
  if (lower.includes('đầu tư') || lower.includes('invest')) return '💰';
  if (lower.includes('thưởng') || lower.includes('gift') || lower.includes('quà')) return '🎁';
  return type === 'income' ? '💵' : '📦';
};
