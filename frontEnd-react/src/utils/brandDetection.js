/**
 * Trả về thông tin thương hiệu tự động dựa trên tên khoản định kỳ (Brand detection engine)
 * @param {string} name
 * @returns {{ brandKey: string, name: string, categoryDefault: string, noteDefault?: string }}
 */
export function detectBrandInfo(name) {
  const lower = (name || '').toLowerCase().trim();

  if (lower.includes('netflix')) {
    return { brandKey: 'netflix', name: 'Netflix', categoryDefault: 'Entertainment', noteDefault: 'Gói xem phim trực tuyến' };
  }
  if (lower.includes('spotify')) {
    return { brandKey: 'spotify', name: 'Spotify', categoryDefault: 'Entertainment', noteDefault: 'Gói nghe nhạc bản quyền' };
  }
  if (lower.includes('youtube') || lower.includes('ytb') || lower.includes('yt pre') || lower.includes('yt premium')) {
    return { brandKey: 'youtube', name: 'YouTube Premium', categoryDefault: 'Entertainment', noteDefault: 'Gói không quảng cáo & Music' };
  }
  if (lower.includes('fpt')) {
    return { brandKey: 'fpt', name: 'Internet FPT', categoryDefault: 'Housing & Bills', noteDefault: 'Gói cước Internet cáp quang' };
  }
  if (lower.includes('viettel')) {
    return { brandKey: 'viettel', name: 'Viettel', categoryDefault: 'Housing & Bills', noteDefault: 'Cước viễn thông / Internet' };
  }
  if (lower.includes('vnpt') || lower.includes('vinaphone')) {
    return { brandKey: 'vnpt', name: 'VNPT', categoryDefault: 'Housing & Bills', noteDefault: 'Cước Internet / Điện thoại' };
  }
  if (lower.includes('apple') || lower.includes('icloud') || lower.includes('apple music') || lower.includes('apple one')) {
    return { brandKey: 'apple', name: 'Apple', categoryDefault: 'Entertainment', noteDefault: 'Dịch vụ iCloud / Apple' };
  }
  if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('chat gpt')) {
    return { brandKey: 'chatgpt', name: 'ChatGPT Plus', categoryDefault: 'Education', noteDefault: 'Thuê bao AI' };
  }
  if (lower.includes('adobe') || lower.includes('photoshop') || lower.includes('creative cloud')) {
    return { brandKey: 'adobe', name: 'Adobe', categoryDefault: 'Other Expense', noteDefault: 'Gói công cụ thiết kế' };
  }
  if (lower.includes('canva')) {
    return { brandKey: 'canva', name: 'Canva Pro', categoryDefault: 'Other Expense', noteDefault: 'Gói thiết kế đồ họa' };
  }
  if (lower.includes('github')) {
    return { brandKey: 'github', name: 'GitHub Pro / Copilot', categoryDefault: 'Education', noteDefault: 'Thuê bao lập trình viên' };
  }
  if (lower.includes('điện') || lower.includes('evn')) {
    return { brandKey: 'electric', name: 'Tiền điện', categoryDefault: 'Housing & Bills', noteDefault: 'Hóa đơn tiền điện sinh hoạt' };
  }
  if (lower.includes('nước') || lower.includes('sawaco')) {
    return { brandKey: 'water', name: 'Tiền nước', categoryDefault: 'Housing & Bills', noteDefault: 'Hóa đơn nước sinh hoạt' };
  }
  if (lower.includes('nhà') || lower.includes('thuê trọ') || lower.includes('chung cư') || lower.includes('phí quản lý')) {
    return { brandKey: 'rent', name: 'Tiền nhà', categoryDefault: 'Housing & Bills', noteDefault: 'Tiền thuê nhà / Phí quản lý' };
  }
  if (lower.includes('trả góp') || lower.includes('iphone') || lower.includes('laptop') || lower.includes('fe credit') || lower.includes('home credit')) {
    return { brandKey: 'installment', name: 'Khoản trả góp', categoryDefault: 'Shopping', noteDefault: 'Trả góp định kỳ' };
  }
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('cali') || lower.includes('citygym')) {
    return { brandKey: 'gym', name: 'Tập Gym', categoryDefault: 'Health & Beauty', noteDefault: 'Thẻ hội viên thể thao' };
  }

  return { brandKey: 'default', name: name || 'Khoản định kỳ', categoryDefault: 'Housing & Bills' };
}
