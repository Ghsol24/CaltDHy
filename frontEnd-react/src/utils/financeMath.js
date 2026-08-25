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
      balanceMap[w.id] = Number(w.initialBalance ?? w.balance ?? 0);
    }
  });

  // Duyệt qua từng giao dịch để cộng / trừ số dư
  transactions.forEach((tx) => {
    if (!tx) return;
    const amount = Number(tx.amount || 0);
    const fee = Number(tx.fee || 0);

    if (tx.type === 'income' && tx.walletId) {
      balanceMap[tx.walletId] = (balanceMap[tx.walletId] || 0) + amount;
    } else if (tx.type === 'expense' && tx.walletId) {
      balanceMap[tx.walletId] = (balanceMap[tx.walletId] || 0) - (amount + fee);
    } else if (tx.type === 'transfer') {
      if (tx.walletId) {
        balanceMap[tx.walletId] = (balanceMap[tx.walletId] || 0) - (amount + fee);
      }
      if (tx.toWalletId) {
        balanceMap[tx.toWalletId] = (balanceMap[tx.toWalletId] || 0) + amount;
      }
    }
  });

  // Gắn currentBalance vào từng wallet
  const calculatedWallets = wallets.map((w) => ({
    ...w,
    currentBalance: balanceMap[w.id] ?? Number(w.initialBalance ?? w.balance ?? 0),
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

  // Tổng tài sản thực tế của tất cả các ví
  const totalBalance = calculatedWallets.reduce(
    (sum, w) => sum + (Number(w.currentBalance) || 0),
    0
  );

  // Tổng số dư các ví chi tiêu khả dụng: KHÔNG bị exclude và KHÔNG phải thẻ tín dụng (credit)
  const availableWalletsBalance = calculatedWallets
    .filter((w) => !w.isExcludedFromTotal && !w.excludeFromTotal && w.type !== 'credit')
    .reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);

  // Tổng tiền đang nằm trong các Hũ tiết kiệm / dự phòng
  const jarMoney = jars.reduce(
    (sum, j) => sum + (Number(j.current ?? j.currentAmount ?? j.balance ?? 0) || 0),
    0
  );

  // Thống kê thu / chi trong tháng hiện tại
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  transactions.forEach((tx) => {
    if (!tx) return;
    const txDate = tx.date || tx.createdAt || '';
    if (currentMonthPrefix && !txDate.startsWith(currentMonthPrefix)) {
      return;
    }

    const amount = Number(tx.amount || 0);
    if (tx.type === 'income') {
      monthlyIncome += amount;
    } else if (tx.type === 'expense') {
      monthlyExpense += amount + (Number(tx.fee) || 0);
    }
  });

  // Tiền khả dụng an toàn = Số dư các ví khả dụng - Tiền đã cam kết bỏ vào Hũ
  const availableToSpend = availableWalletsBalance - jarMoney;

  return {
    availableToSpend,
    totalBalance,
    monthlyIncome,
    monthlyExpense,
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
  let income = 0;
  let expense = 0;
  let count = 0;
  const byCategory = {};

  transactions.forEach((tx) => {
    if (!tx) return;
    const txDate = tx.date || tx.createdAt || '';
    if (monthPrefix && !txDate.startsWith(monthPrefix)) {
      return;
    }

    count += 1;
    const amount = Number(tx.amount || 0);

    if (tx.type === 'income') {
      income += amount;
    } else if (tx.type === 'expense') {
      expense += amount;
      const cat = tx.category || 'Khác';
      byCategory[cat] = (byCategory[cat] || 0) + amount;
    }
  });

  const net = income - expense;

  return {
    income,
    expense,
    net,
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
