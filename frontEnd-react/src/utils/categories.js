export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'food' },
  { name: 'Shopping', icon: 'shopping' },
  { name: 'Transportation', icon: 'transportation' },
  { name: 'Housing & Bills', icon: 'housing' },
  { name: 'Entertainment', icon: 'entertainment' },
  { name: 'Health & Beauty', icon: 'health' },
  { name: 'Education', icon: 'education' },
  { name: 'Travel', icon: 'travel' },
  { name: 'Other Expense', icon: 'other-expense' }
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'salary' },
  { name: 'Business', icon: 'business' },
  { name: 'Investment', icon: 'investment' },
  { name: 'Gift & Bonus', icon: 'gift' },
  { name: 'Other Income', icon: 'other-income' }
];

export const getCategoryIcon = (categoryName, type = 'expense') => {
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
  const found = all.find((c) => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  if (found) return found.icon;
  const lower = (categoryName || '').toLowerCase();
  if (lower.includes('ăn') || lower.includes('food') || lower.includes('uống') || lower.includes('cà phê') || lower.includes('dining')) return 'food';
  if (lower.includes('mua') || lower.includes('shop')) return 'shopping';
  if (lower.includes('xe') || lower.includes('xăng') || lower.includes('đi lại') || lower.includes('transport')) return 'transportation';
  if (lower.includes('nhà') || lower.includes('bill') || lower.includes('điện') || lower.includes('nước') || lower.includes('housing')) return 'housing';
  if (lower.includes('sức khỏe') || lower.includes('thuốc') || lower.includes('health') || lower.includes('beauty') || lower.includes('y tế')) return 'health';
  if (lower.includes('học') || lower.includes('sách') || lower.includes('edu')) return 'education';
  if (lower.includes('chơi') || lower.includes('game') || lower.includes('phim') || lower.includes('entertain')) return 'entertainment';
  if (lower.includes('lương') || lower.includes('salary')) return 'salary';
  if (lower.includes('kinh doanh') || lower.includes('business')) return 'business';
  if (lower.includes('đầu tư') || lower.includes('invest')) return 'investment';
  if (lower.includes('thưởng') || lower.includes('gift') || lower.includes('quà')) return 'gift';
  return type === 'income' ? 'other-income' : 'other-expense';
};
