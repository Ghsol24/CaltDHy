// Trạng thái thẻ "Bắt đầu trong 3 bước" ở Trang chủ (đợt 16d). Hàm thuần để test được.

export const HOME_ONBOARDING_STEP_IDS = ['wallet', 'budget', 'transaction'];

/**
 * - wallet: có ví mang số dư ban đầu khác 0, hoặc người dùng đã tự tạo ví (hơn một ví / có lịch sử
 *   ví). Không tính số dư sinh ra từ giao dịch, để bước 1 không tự xong nhờ bước 3.
 * - budget: có ít nhất một hạn mức tháng > 0.
 * - transaction: có giao dịch do người dùng ghi (không tính giao dịch hệ thống tạo).
 */
export function getHomeOnboardingSteps({ wallets = [], walletHistory = [], budgets = {}, transactions = [] } = {}) {
  const list = Array.isArray(wallets) ? wallets : [];
  const done = {
    wallet: list.some((w) => Number(w?.initialBalance) !== 0 && Number.isFinite(Number(w?.initialBalance)))
      || list.length > 1 || (Array.isArray(walletHistory) && walletHistory.length > 0),
    budget: Object.values(budgets && typeof budgets === 'object' ? budgets : {}).some((limit) => Number(limit) > 0),
    transaction: (Array.isArray(transactions) ? transactions : []).some((txn) => txn && !txn.systemGenerated),
  };
  const steps = HOME_ONBOARDING_STEP_IDS.map((id) => ({ id, done: done[id] }));
  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, allDone: doneCount === steps.length };
}
