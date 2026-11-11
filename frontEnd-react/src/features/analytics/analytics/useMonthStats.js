import { useMemo } from 'react';
import { getCategoryIcon } from '../../../utils/categories';
import { CATEGORY_COLORS } from './categoryColors';

export function useMonthStats({ activeMonth, transactions }) {
  const monthData = useMemo(() => {
    const filtered = transactions.filter((t) => t.date && t.date.startsWith(activeMonth));
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const catMap = Object.create(null);

    filtered.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const fee = Number(t.fee) || 0;

      if (t.type === 'income') {
        income += amt;
        incomeCount += 1;
      } else if (t.type === 'expense') {
        const total = amt + fee;
        expense += total;
        expenseCount += 1;
        const cat = t.category || 'Khác';
        catMap[cat] = (catMap[cat] || 0) + total;
      }
    });

    const net = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const categories = Object.entries(catMap)
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: expense > 0 ? (amount / expense) * 100 : 0,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        icon: getCategoryIcon(name, 'expense')
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income,
      expense,
      net,
      savingsRate,
      incomeCount,
      expenseCount,
      totalCount: filtered.length,
      categories
    };
  }, [transactions, activeMonth]);
  return { monthData };
}
