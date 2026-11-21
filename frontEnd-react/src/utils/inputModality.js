// Ghi lại người dùng đang dùng chuột/cảm ứng hay bàn phím lên <html data-input>, để base.css
// chỉ vẽ vòng focus của nút khi thật sự dùng bàn phím. Chrome vẫn coi focus do code trả về
// (sau khi chọn trong popover) là :focus-visible dù người dùng vừa bấm chuột (đợt 15a).
// Chỉ phím điều hướng mới bật chế độ bàn phím, nên gõ chữ vào ô nhập không làm vòng nhấp nháy.
const NAV_KEYS = new Set(['Tab', 'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

export function trackInputModality(root = document.documentElement) {
  const set = (mode) => {
    if (root.dataset.input !== mode) root.dataset.input = mode;
  };
  window.addEventListener('pointerdown', () => set('pointer'), { capture: true, passive: true });
  window.addEventListener('keydown', (event) => {
    if (NAV_KEYS.has(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) set('keyboard');
  }, true);
}
