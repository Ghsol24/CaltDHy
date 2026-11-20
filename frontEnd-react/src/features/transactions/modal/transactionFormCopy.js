// Chữ của bố cục máy tính "Phương án 3" (đợt 13: số tiền lớn + danh sách nhóm). Nằm cạnh form (tải
// theo nhu cầu) thay vì trong từ điển chung để ngân sách JavaScript khởi đầu không đổi.
const COPY = {
  vi: {
    rowCategory: 'Danh mục', rowIncomeSource: 'Nguồn thu',
    rowWallet: 'Tài khoản', rowIncomeWallet: 'Nhận vào ví',
    rowDate: 'Ngày', rowNote: 'Ghi chú', notePlaceholder: 'Thêm ghi chú',
    quickCategories: 'Danh mục hay dùng',
    searchIn: (count) => `Tìm trong ${count} danh mục…`,
    balanceAfter: ({ wallet, amount }) => `Sau khi nạp · ${wallet} đạt ${amount}`,
    balanceNow: ({ wallet, amount }) => `Nhận vào ${wallet} · số dư ${amount}`,
    saveIncome: 'Lưu thu nhập', saveChanges: 'Lưu thay đổi',
    chooseCategory: 'Chọn danh mục', noCategories: 'Chưa có danh mục'
  },
  en: {
    rowCategory: 'Category', rowIncomeSource: 'Source',
    rowWallet: 'Account', rowIncomeWallet: 'Into',
    rowDate: 'Date', rowNote: 'Note', notePlaceholder: 'Add a note',
    quickCategories: 'Frequent categories',
    searchIn: (count) => `Search ${count} categories…`,
    balanceAfter: ({ wallet, amount }) => `After this · ${wallet} reaches ${amount}`,
    balanceNow: ({ wallet, amount }) => `Into ${wallet} · balance ${amount}`,
    saveIncome: 'Save income', saveChanges: 'Save changes',
    chooseCategory: 'Choose a category', noCategories: 'No categories yet'
  },
  'zh-CN': {
    rowCategory: '分类', rowIncomeSource: '来源',
    rowWallet: '账户', rowIncomeWallet: '存入',
    rowDate: '日期', rowNote: '备注', notePlaceholder: '添加备注',
    quickCategories: '常用分类',
    searchIn: (count) => `在 ${count} 个分类中搜索…`,
    balanceAfter: ({ wallet, amount }) => `存入后 · ${wallet} 余额 ${amount}`,
    balanceNow: ({ wallet, amount }) => `存入 ${wallet} · 余额 ${amount}`,
    saveIncome: '保存收入', saveChanges: '保存更改',
    chooseCategory: '选择分类', noCategories: '暂无分类'
  }
};

export const getTransactionFormCopy = (lang) => COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi);
