import { useLayoutEffect, useState } from 'react';

// Trang Ví đủ rộng thì chia hai khung: danh sách ví bên trái, chi tiết ví bên phải (đợt 15d).
// Đo chính khung trang chứ không đo cửa sổ, vì sidebar kéo dãn / thu gọn được.
export const WALLET_SPLIT_MIN_WIDTH = 860;

export function useWalletSplit(ref) {
  const [isSplit, setIsSplit] = useState(false);

  // useLayoutEffect: đo trước khi vẽ, để lần đầu mở trang không nháy bố cục một cột.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = (width) => setIsSplit(width >= WALLET_SPLIT_MIN_WIDTH);
    update(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isSplit;
}
