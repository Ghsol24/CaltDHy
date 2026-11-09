import { useCallback } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useToastStore } from '../../stores/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { getLocalMonthString } from '../../utils/formatters';
import { getUserErrorMessage } from '../../utils/userErrors';
import { deleteConfirmMessage } from '../../utils/transactionMessages';

/** Jar and recurring entries are managed (and undone) from their own screens. */
export const isLockedTransaction = (transaction) =>
  Boolean(transaction?.systemGenerated || transaction?.jarId || transaction?.installmentId);

/**
 * One delete flow for every screen: confirm (with previous-month impact), delete,
 * then an undo toast that restores the entry under its original ID.
 * Resolves true once deleted, false if the user kept it.
 */
export function useDeleteTransaction() {
  const { t, label, lang, intlLocale } = useTranslation();
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction);
  const restoreTransaction = useTransactionStore((s) => s.restoreTransaction);
  const wallets = useWalletStore((s) => s.wallets);
  const archivedWallets = useWalletStore((s) => s.archivedWallets);
  const confirm = useConfirmStore((s) => s.confirm);
  const addToast = useToastStore((s) => s.addToast);

  return useCallback((transaction, { onDeleted } = {}) => {
    if (!transaction?.id || isLockedTransaction(transaction)) return Promise.resolve(false);
    const name = transaction.desc || label(transaction.category);
    const restore = async () => {
      try {
        await restoreTransaction(transaction.id);
        addToast({ type: 'success', message: t('transaction.restored', { name }), duration: 4000 });
      } catch (error) {
        const message = getUserErrorMessage(error, 'transaction.restoreFailed');
        if (message) addToast({ type: 'error', message, duration: 6000 });
      }
    };
    return confirm({
      title: t('home.deleteTitle'),
      message: deleteConfirmMessage(transaction, {
        t, label, wallets: [...wallets, ...archivedWallets], locale: lang, intlLocale,
        currentMonth: getLocalMonthString()
      }),
      confirmText: t('home.deleteTitle'),
      cancelText: t('home.keep'),
      confirmVariant: 'danger',
      onConfirm: async () => {
        await deleteTransaction(transaction.id);
        onDeleted?.();
        addToast({
          type: 'info',
          message: t('home.deleted', { name }),
          action: { label: t('transaction.undo'), onClick: () => { void restore(); } },
          duration: 6000,
        });
      },
    });
  }, [t, label, lang, intlLocale, deleteTransaction, restoreTransaction, wallets, archivedWallets, confirm, addToast]);
}
