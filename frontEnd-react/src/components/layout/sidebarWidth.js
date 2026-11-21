// Độ rộng sidebar máy tính do người dùng kéo (đợt 15c). Tiện ích riêng từng trình duyệt:
// bộ nhớ bị chặn thì sidebar về độ rộng mặc định.
const SIDEBAR_WIDTH_KEY = 'caltdhy_sidebar_width';

export const SIDEBAR_DEFAULT_WIDTH = 260;
// Hẹp hơn thì "Lịch sử giao dịch" bị cắt; muốn hẹp nữa thì thu gọn bằng nút ☰.
export const SIDEBAR_MIN_WIDTH = 200;

// Tối đa 1/5 chiều ngang trang. Màn hẹp hơn 1300px thì 1/5 nhỏ hơn độ rộng mặc định, khi đó
// trần là mặc định (sidebar không tự hẹp đi so với trước). Khớp với clamp() trong app-shell.css.
export function sidebarMaxWidth(viewportWidth = window.innerWidth) {
  return Math.max(SIDEBAR_DEFAULT_WIDTH, Math.floor(viewportWidth / 5));
}

export function clampSidebarWidth(width, viewportWidth) {
  return Math.round(Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), sidebarMaxWidth(viewportWidth)));
}

// Giữ đúng số đã kéo (không cắt theo cửa sổ hiện tại): sang màn to hơn thì sidebar rộng lại như cũ.
export function readSidebarWidth() {
  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored) && stored >= SIDEBAR_MIN_WIDTH ? Math.round(stored) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

export function saveSidebarWidth(width) {
  try {
    if (width === SIDEBAR_DEFAULT_WIDTH) {
      localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    } else {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    }
  } catch {
    // Storage unavailable: the width lasts for this visit only.
  }
}
