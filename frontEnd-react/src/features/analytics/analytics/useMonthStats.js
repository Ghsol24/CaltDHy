import { useMemo } from 'react';
import { getCategoryIcon } from '../../../utils/categories';
import { colorVarForRank } from './categoryColors';

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

    // Rank first, then colour by rank: the biggest category always gets the first hue.
    const categories = Object.entries(catMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percent: expense > 0 ? (amount / expense) * 100 : 0,
        icon: getCategoryIcon(name, 'expense')
      }))
      .sort((a, b) => b.amount - a.amount)
      .map((category, rank) => ({ ...category, color: `var(${colorVarForRank(rank)})` }));

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
