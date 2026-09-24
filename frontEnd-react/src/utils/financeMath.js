import { moneyInteger, moneyNumber, sumMoney } from './moneyPrecision.js';

/**
 * CaltDHy v2 — Finance Math Helpers
 * Cung cấp các hàm tính toán số dư ví, tiền khả dụng chi tiêu, thống kê tháng, và trạng thái ngân sách.
 */

/**
 * Tính toán số dư hiện tại của từng ví dựa trên số dư ban đầu và lịch sử giao dịch.
 *
 * @param {Array<Object>} wallets - Danh sách ví [{ id, initialBalance, ... }]
 * @param {Array<Object>} transactions - Danh sách giao dịch [{ type, amount, fee, walletId, toWalletId, ... }]
 * @returns {{ balances: Object.<string, number>, wallets: Array<Object>, [key: string]: any }}
 */
export function calculateWalletBalances(wallets = [], transactions = []) {
  const balanceMap = {};

  // Khởi tạo số dư ban đầu cho tất cả các ví
  wallets.forEach((w) => {
    if (w && w.id) {
      balanceMap[w.id] = moneyInteger(w.initialBalance ?? w.balance ?? 0);
    }
  });

  // Duyệt qua từng giao dịch để cộng / trừ số dư
  transactions.forEach((tx) => {
    if (!tx) return;
    const amount = moneyInteger(tx.amount ?? 0);
    const fee = moneyInteger(tx.fee ?? 0);

    if (tx.type === 'income' && tx.walletId) {
      balanceMap[tx.walletId] = (balanceMap[tx.walletId] ?? 0n) + amount;
    } else if (tx.type === 'expense' && tx.walletId) {
      balanceMap[tx.walletId] = (balanceMap[tx.walletId] ?? 0n) - (amount + fee);
    } else if (tx.type === 'transfer') {
      if (tx.walletId) {
        balanceMap[tx.walletId] = (balanceMap[tx.walletId] ?? 0n) - (amount + fee);
      }
      if (tx.toWalletId) {
        balanceMap[tx.toWalletId] = (balanceMap[tx.toWalletId] ?? 0n) + amount;
      }
    }
  });

  for (const id of Object.keys(balanceMap)) balanceMap[id] = moneyNumber(balanceMap[id]);
  // Gắn currentBalance vào từng wallet
  const calculatedWallets = wallets.map((w) => ({
    ...w,
    currentBalance: balanceMap[w.id] ?? moneyNumber(w.initialBalance ?? w.balance ?? 0),
  }));

  return {
    ...balanceMap,
    balances: balanceMap,
    wallets: calculatedWallets,
  };
}

/**
 * Tính số tiền khả dụng an toàn có thể chi tiêu trong kỳ.
 *
 * @param {Object} params
 * @param {Array<Object>} [params.wallets=[]]
 * @param {Array<Object>} [params.transactions=[]]
 * @param {Array<Object>} [params.budgets=[]]
 * @param {Array<Object>} [params.jars=[]]
 * @param {string} [params.currentMonthPrefix=''] - vd: '2026-08'
 * @returns {{ availableToSpend: number, totalBalance: number, monthlyIncome: number, monthlyExpense: number, inJars: number }}
 */
export function calculateAvailableToSpend({
  wallets = [],
  transactions = [],
  jars = [],
  currentMonthPrefix = '',
} = {}) {
  // Tính số dư cho các ví
  const { wallets: calculatedWallets } = calculateWalletBalances(wallets, transactions);

  // Tổng tài sản thực tế của tất cả các ví đang hoạt động (không bao gồm ví đã lưu trữ)
  const totalBalance = moneyNumber(sumMoney(calculatedWallets
    .filter((w) => !w.archived).map(w => w.currentBalance)));

  // Tổng số dư các ví chi tiêu khả dụng: KHÔNG bị exclude, KHÔNG phải thẻ tín dụng (credit) và KHÔNG bị lưu trữ
  const availableWalletsBalance = moneyNumber(sumMoney(calculatedWallets
    .filter((w) => !w.isExcludedFromTotal && !w.excludeFromTotal && w.type !== 'credit' && !w.archived)
    .map(w => w.currentBalance)));

  // Tổng tiền đang nằm trong các Hũ tiết kiệm / dự phòng
  const jarMoney = moneyNumber(sumMoney(jars.map(j => j.current ?? j.currentAmount ?? j.balance ?? 0)));

  // Thống kê thu / chi trong tháng hiện tại
  let monthlyIncome = 0n;
  let monthlyExpense = 0n;

  transactions.forEach((tx) => {
    if (!tx) return;
    const txDate = tx.date || tx.createdAt || '';
    if (currentMonthPrefix && !txDate.startsWith(currentMonthPrefix)) {
      return;
    }

    const amount = moneyInteger(tx.amount ?? 0);
    if (tx.type === 'income') {
      monthlyIncome += amount;
    } else if (tx.type === 'expense') {
      monthlyExpense += amount + moneyInteger(tx.fee ?? 0);
    }
  });

  // Tiền khả dụng an toàn = Số dư các ví chi tiêu khả dụng
  // Lưu ý: Nạp tiền vào Hũ đã là giao dịch 'transfer' trừ trực tiếp vào số dư ví nguồn (ở calculateWalletBalances),
  // do đó availableWalletsBalance đã tự động loại trừ tiền trong Hũ. Tuyệt đối không trừ jarMoney lần 2.
  const availableToSpend = availableWalletsBalance;

  return {
    availableToSpend,
    totalBalance,
    monthlyIncome: moneyNumber(monthlyIncome),
    monthlyExpense: moneyNumber(monthlyExpense),
    inJars: jarMoney,
  };
}

/**
 * Thống kê thu, chi, số dư ròng và phân bổ theo danh mục cho một tháng.
 *
 * @param {Array<Object>} transactions - Danh sách giao dịch
 * @param {string} [monthPrefix=''] - Tiền tố tháng 'YYYY-MM'
 * @returns {{ income: number, expense: number, net: number, count: number, byCategory: Object.<string, number> }}
 */
export function calculateMonthlyStats(transactions = [], monthPrefix = '') {
  let income = 0n;
  let expense = 0n;
  let count = 0;
  const byCategory = Object.create(null);

  transactions.forEach((tx) => {
    if (!tx) return;
    const txDate = tx.date || tx.createdAt || '';
    if (monthPrefix && !txDate.startsWith(monthPrefix)) {
      return;
    }

    count += 1;
    const amount = moneyInteger(tx.amount ?? 0);
    const fee = moneyInteger(tx.fee ?? 0);

    if (tx.type === 'income') {
      income += amount;
    } else if (tx.type === 'expense') {
      const totalExpense = amount + fee;
      expense += totalExpense;
      const cat = tx.category || 'Khác';
      byCategory[cat] = (byCategory[cat] ?? 0n) + totalExpense;
    }
  });

  const net = income - expense;
  for (const category of Object.keys(byCategory)) byCategory[category] = moneyNumber(byCategory[category]);

  return {
    income: moneyNumber(income),
    expense: moneyNumber(expense),
    totalIncome: moneyNumber(income),
    totalExpense: moneyNumber(expense),
    net: moneyNumber(net),
    count,
    byCategory,
  };
}

/**
 * Đánh giá trạng thái ngân sách so với hạn mức chi tiêu.
 *
 * @param {number} spent - Số tiền đã chi
 * @param {number} limit - Hạn mức ngân sách
 * @returns {{ percent: number, remaining: number, status: 'normal'|'warning'|'danger', isOver: boolean }}
 */
export function getBudgetStatus(spent = 0, limit = 0) {
  const numSpent = Number(spent) || 0;
  const numLimit = Number(limit) || 0;

  if (numLimit <= 0) {
    return {
      percent: 0,
      remaining: 0,
      status: 'normal',
      isOver: false,
    };
  }

  const percent = Math.round((numSpent / numLimit) * 100);
  const remaining = numLimit - numSpent;
  const isOver = numSpent > numLimit;

  let status = 'normal';
  if (percent >= 100) {
    status = 'danger';
  } else if (percent >= 75) {
    status = 'warning';
  }

  return {
    percent,
    remaining,
    status,
    isOver,
  };
}
