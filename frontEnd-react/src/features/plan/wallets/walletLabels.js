// One set of wallet-type names for every screen (WAL-06).
export const WALLET_TYPE_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  credit: 'Thẻ tín dụng',
  'e-wallet': 'Ví điện tử'
};

// Red and orange read as warnings, so wallets no longer offer them (WAL-02).
// Wallets saved with them keep their data and are only shown in a replacement.
const LEGACY_WALLET_COLORS = { '#dc2626': '#4D7C0F', '#ea580c': '#C026D3' };

export function displayWalletColor(color, fallback) {
  if (!color) return fallback;
  return LEGACY_WALLET_COLORS[String(color).toLowerCase()] || color;
}

// Distribution chart: colours follow rank by size, never the user's choice, so two
// wallets of the same colour stay distinguishable (WAL-09).
export const DISTRIBUTION_PALETTE = ['#4F46E5', '#0D9488', '#8B5CF6', '#0EA5E9', '#C026D3', '#4D7C0F', '#64748B', '#BE185D'];
