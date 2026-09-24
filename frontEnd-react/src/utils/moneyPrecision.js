export const MAX_MONEY = BigInt(Number.MAX_SAFE_INTEGER);

export function moneyInteger(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RangeError('Giá trị tiền tệ không phải số nguyên chính xác.');
  }
  return BigInt(value);
}

export function moneyNumber(value) {
  const exact = moneyInteger(value);
  if (exact > MAX_MONEY || exact < -MAX_MONEY) {
    throw new RangeError('Tổng tiền vượt giới hạn hiển thị chính xác.');
  }
  return Number(exact);
}

export function sumMoney(values) {
  return values.reduce((total, value) => total + moneyInteger(value), 0n);
}

// Legacy charts require Number. Bound the total magnitude of their inputs before
// rendering any chart, so subset sums and differences cannot silently overflow.
export function inspectMoneyDisplay({ transactions = [], wallets = [], jars = [], installments = [], budgets = {} }) {
  let magnitude = 0n;
  let turnover = 0n;
  const include = (value = 0) => {
    const exact = moneyInteger(value);
    magnitude += exact < 0n ? -exact : exact;
    return exact;
  };
  try {
    for (const item of transactions) {
      turnover += include(item.amount) + include(item.fee);
    }
    for (const item of wallets) {
      include(item.initialBalance); include(item.creditLimit);
    }
    for (const item of jars) {
      include(item.current); include(item.target);
      for (const entry of item.history || []) include(entry.amount);
    }
    for (const item of installments) {
      include(item.amount); include(item.totalPaid);
      for (const entry of item.history || []) include(entry.amount);
    }
    for (const value of Object.values(budgets)) include(value);
    return { safe: magnitude <= MAX_MONEY, turnover, invalid: false };
  } catch {
    return { safe: false, turnover: null, invalid: true };
  }
}
