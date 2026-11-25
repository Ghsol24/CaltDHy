// Gắn <html data-scrolling> trong lúc trang đang cuộn, gỡ ra khi dừng 150ms (đợt 15h).
// Khi cuộn bằng trackpad, nội dung trượt dưới con trỏ đứng yên: trình duyệt bắn hover và
// mouseenter/mouseleave liên tục (thẻ KPI nhấc lên, dòng danh mục vẽ lại donut), còn viên
// kính phải làm mờ lại phần phía sau mỗi frame. app-shell.css dựa vào thuộc tính này để tắt
// hover trong tấm nội dung và thay kính mờ bằng nền đặc cho tới khi cuộn xong.
const IDLE_MS = 150;

export function trackScrollActivity(root = document.documentElement) {
  let idleTimer = 0;
  const stop = () => {
    idleTimer = 0;
    delete root.dataset.scrolling;
  };
  window.addEventListener('scroll', () => {
    if (!idleTimer) root.dataset.scrolling = '';
    else clearTimeout(idleTimer);
    idleTimer = setTimeout(stop, IDLE_MS);
  }, { passive: true });
}
