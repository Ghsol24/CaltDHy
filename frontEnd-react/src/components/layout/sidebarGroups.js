// Các nhóm sidebar người dùng đã bấm cố định mở trên máy tính.
// Mặc định mọi nhóm đều thu gọn (chỉ xổ tạm khi di chuột vào); chỉ khi bấm vào tiêu đề mới ghim giữ nguyên.
const PINNED_GROUPS_KEY = 'caltdhy_sidebar_pinned_groups';

export function readPinnedGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem(PINNED_GROUPS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function savePinnedGroups(groups) {
  try {
    if (!groups.length) {
      localStorage.removeItem(PINNED_GROUPS_KEY);
    } else {
      localStorage.setItem(PINNED_GROUPS_KEY, JSON.stringify(groups));
    }
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}
