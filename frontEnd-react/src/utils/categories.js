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
  return type === 'income' ? '💵' : '💸';
};
