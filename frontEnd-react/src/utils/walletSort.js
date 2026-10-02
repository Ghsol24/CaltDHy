import { moneyInteger } from './moneyPrecision.js';

// Match the balance shown in wallet dropdowns. Retain the store order for ties
// and leave the original array intact so default selections stay unchanged.
export function sortWalletsByBalance(wallets = []) {
  return wallets
    .map((wallet, index) => ({
      wallet,
      index,
      balance: moneyInteger(wallet.currentBalance ?? wallet.initialBalance ?? 0),
    }))
    .sort((a, b) => a.balance === b.balance
      ? a.index - b.index
      : a.balance > b.balance ? -1 : 1)
    .map(({ wallet }) => wallet);
}
