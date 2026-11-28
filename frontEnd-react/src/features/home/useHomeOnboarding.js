import { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { getLocalMonthString } from '../../utils/formatters';
import { getHomeOnboardingSteps } from '../../utils/homeOnboarding';

/**
 * "Bắt đầu trong 3 bước" (đợt 16d): ví → hạn mức tháng → giao dịch đầu tiên. Chỉ hiện khi dữ liệu
 * đã tải xong và còn ít nhất một bước chưa làm; "Ẩn" lưu theo tài khoản
 * (user.preferences.homeOnboardingDismissed trên server), nên đổi máy vẫn không hiện lại.
 * Nằm ở cột phải Trang chủ, thay chỗ lời nhắc đặt ngân sách của AttentionPanel khi đang hiện.
 */
export function useHomeOnboarding() {
  const user = useAuthStore((state) => state.user);
  const updatePreferences = useAuthStore((state) => state.updatePreferences);
  const wallets = useWalletStore((state) => state.wallets);
  const walletHistory = useWalletStore((state) => state.walletHistory);
  const walletsFailed = useWalletStore((state) => state.loadFailed);
  const transactions = useTransactionStore((state) => state.transactions);
  const hasLoadedTransactions = useTransactionStore((state) => state.hasLoadedTransactions);
  const transactionsFailed = useTransactionStore((state) => state.loadFailed);
  const budgets = useTransactionStore((state) => state.budgets);
  const budgetMonth = useTransactionStore((state) => state.budgetMonth);
  const [hiddenNow, setHiddenNow] = useState(false);

  const currentMonth = getLocalMonthString();
  // Server luôn tạo sẵn ví "Tiền mặt", nên danh sách ví rỗng nghĩa là chưa tải xong.
  const ready = Boolean(user) && hasLoadedTransactions && wallets.length > 0 && budgetMonth === currentMonth
    && !walletsFailed && !transactionsFailed;

  const { steps, doneCount, allDone } = useMemo(
    () => getHomeOnboardingSteps({ wallets, walletHistory, budgets, transactions }),
    [wallets, walletHistory, budgets, transactions]
  );
  const dismissed = hiddenNow || user?.preferences?.homeOnboardingDismissed === true;
  const visible = ready && !dismissed && !allDone;

  const dismiss = () => {
    setHiddenNow(true);
    updatePreferences({ homeOnboardingDismissed: true }).catch(() => {});
  };

  return { visible, steps, doneCount, dismiss };
}
