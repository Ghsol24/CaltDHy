/* ============================================================
   CaltDHy — hooks/useTransactions.js
   Custom hook quản lý toàn bộ state giao dịch, ngân sách, danh mục.
   Đây là "trái tim" của business logic — migrate từ spending.js.
   ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import {
  apiGetTransactions, apiAddTransaction, apiUpdateTransaction, apiDeleteTransaction,
  apiGetBudgets, apiUpdateBudgets, apiGetCustomCategories, apiUpdateCustomCategories
} from '../services/api';


// ── Constants (migrate từ spending.js) ──
export const STORAGE_KEY = 'caltdhy_txns';
export const BUDGET_KEY = 'caltdhy_budgets';
export const CUSTOM_CATS_KEY = 'caltdhy_custom_cats';
export const HIDDEN_CATS_KEY = 'caltdhy_hidden_cats';
export const CAT_ORDER_KEY = 'caltdhy_cat_order';
export const BALANCE_RESET_KEY = 'caltdhy_balance_reset_mode';
export const EXCHANGE_RATE = 27000; // 1 USD = 27,000 VND
export const CNY_RATE = 3750; // 1 CNY = 3,750 VND

export const DEFAULT_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Health', 'Utilities', 'Salary', 'Freelance', 'Installment', 'Other'
];

export const CAT_ICONS = {
  'Food & Dining': '🍜', 'Transport': '🚗', 'Shopping': '🛍️',
  'Entertainment': '🎦', 'Health': '💊', 'Utilities': '⚡',
  'Salary': '💵', 'Freelance': '💻', 'Installment': '💳', 'Other': '📦'
};

export const DEFAULT_INCOME_CATS = ['Salary', 'Freelance'];

// ── Chart Colors (nguyên bản từ spending.js — STABLE, không được đổi thứ tự) ──
export const STABLE_CHART_COLORS = [
  { bg: '#ff4757', glow: 'rgba(255,71,87,.75)' },   // Crimson Red
  { bg: '#3498db', glow: 'rgba(52,152,219,.75)' },  // Cyber Blue
  { bg: '#2ecc71', glow: 'rgba(46,204,113,.75)' },  // Acid Green
  { bg: '#ff9f43', glow: 'rgba(255,159,67,.75)' },  // Amber Orange
  { bg: '#9b59b6', glow: 'rgba(155,89,182,.75)' },  // Violet Purple
  { bg: '#1abc9c', glow: 'rgba(26,188,156,.75)' },  // Deep Teal
  { bg: '#ff6b81', glow: 'rgba(255,107,129,.75)' }, // Hot Pink
  { bg: '#f1c40f', glow: 'rgba(241,196,15,.75)' },  // Neon Yellow
  { bg: '#00d2fc', glow: 'rgba(0,210,252,.75)' },   // Ice Cyan
  { bg: '#ff4d4d', glow: 'rgba(255,77,77,.75)' },   // Coral Red
  { bg: '#26de81', glow: 'rgba(38,222,129,.75)' },  // Mint Green
  { bg: '#a55eea', glow: 'rgba(165,94,234,.75)' },  // Soft Lavender
  { bg: '#e67e22', glow: 'rgba(230,126,34,.75)' },  // Bright Tangerine
  { bg: '#54a0ff', glow: 'rgba(84,160,255,.75)' },  // Steel Blue
  { bg: '#10ac84', glow: 'rgba(16,172,132,.75)' },  // Emerald Forest
  { bg: '#fd79a8', glow: 'rgba(253,121,168,.75)' }, // Rose Gold
];

/**
 * Lấy màu sắc ổn định cho một danh mục — giống thuật toán gốc trong spending.js.
 * Danh mục mặc định dùng index cố định; danh mục tùy chỉnh dùng hash tên.
 */
export function getCategoryColor(catName) {
  const defaultIdx = DEFAULT_CATEGORIES.indexOf(catName);
  if (defaultIdx !== -1) {
    return STABLE_CHART_COLORS[defaultIdx % STABLE_CHART_COLORS.length];
  }
  // Hash tên danh mục → index ổn định
  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STABLE_CHART_COLORS[Math.abs(hash) % STABLE_CHART_COLORS.length];
}

/**
 * Hàm phân tích biểu thức toán học an toàn (không dùng eval/new Function).
 * Hỗ trợ: +, -, *, /, (, ), x → *, : → /
 * Ví dụ: "50000+20000" → 70000, "100k*3" không hỗ trợ (chỉ số thuần)
 */
export function evalMathExpression(str) {
  if (!str) return NaN;
  let s = str.replace(/\s+/g, '').replace(/x/gi, '*').replace(/:/g, '/');
  if (!/^[0-9.+\-*/()]+$/.test(s)) {
    s = s.replace(/([.,])(?=\d{3}(?!\d))/g, '');
  }
  if (!/^[0-9.+\-*/()]+$/.test(s)) return NaN;
  let pos = 0;
  function parseNumber() {
    let numStr = '';
    while (pos < s.length && /[0-9.]/.test(s[pos])) numStr += s[pos++];
    return numStr ? parseFloat(numStr) : NaN;
  }
  function parseFactor() {
    if (s[pos] === '(') { pos++; const v = parseExpr(); if (s[pos] === ')') pos++; return v; }
    if (s[pos] === '-') { pos++; return -parseFactor(); }
    return parseNumber();
  }
  function parseTerm() {
    let v = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++]; const r = parseFactor();
      v = op === '*' ? v * r : (r === 0 ? NaN : v / r);
    }
    return v;
  }
  function parseExpr() {
    let v = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++]; const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  try {
    const result = parseExpr();
    return (pos === s.length && isFinite(result)) ? result : NaN;
  } catch { return NaN; }
}

// ── Helpers ──
function parseCategories(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') {
      try {
        const p = JSON.parse(item);
        if (p && typeof p.name === 'string')
          return { name: p.name.trim(), type: p.type === 'income' ? 'income' : 'expense' };
      } catch {}
      return { name: item.trim(), type: 'expense' };
    }
    if (typeof item === 'object' && item !== null && typeof item.name === 'string') {
      return { name: item.name.trim(), type: item.type === 'income' ? 'income' : 'expense' };
    }
    return null;
  }).filter(Boolean);
}

function serializeCategories(arr) {
  return arr.map(c => JSON.stringify({ name: c.name, type: c.type }));
}

function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function useTransactions() {
  const [transactions, setTransactions] = useState(() => readLS(STORAGE_KEY, []));
  const [budgets, setBudgets] = useState(() => readLS(BUDGET_KEY, {}));
  const [customCategories, setCustomCategoriesRaw] = useState(() =>
    parseCategories(readLS(CUSTOM_CATS_KEY, []))
  );
  const [hiddenDefaultCategories, setHiddenDefault] = useState(() => readLS(HIDDEN_CATS_KEY, []));
  const [categoryOrder, setCategoryOrder] = useState(() => readLS(CAT_ORDER_KEY, []));
  const [balanceResetMode, setBalanceResetMode] = useState(() =>
    localStorage.getItem(BALANCE_RESET_KEY) || 'keep'
  );
  const [syncing, setSyncing] = useState(false);

  // ── Persist to localStorage whenever state changes ──
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => {
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(serializeCategories(customCategories)));
  }, [customCategories]);
  useEffect(() => { localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify(hiddenDefaultCategories)); }, [hiddenDefaultCategories]);
  useEffect(() => { localStorage.setItem(CAT_ORDER_KEY, JSON.stringify(categoryOrder)); }, [categoryOrder]);
  useEffect(() => { localStorage.setItem(BALANCE_RESET_KEY, balanceResetMode); }, [balanceResetMode]);

  // ── Fetch từ server khi mount ──
  useEffect(() => {
    setSyncing(true);
    // Fetch transactions
    apiGetTransactions()
      .then(data => {
        if (Array.isArray(data)) setTransactions(data);
        else if (data?.data) setTransactions(data.data);
      })
      .catch(() => {
        console.warn('[CaltDHy] Offline mode: dùng dữ liệu từ localStorage cho transactions.');
      });

    // Fetch budgets
    apiGetBudgets()
      .then(res => {
        if (res?.success && res.data) {
          setBudgets(res.data);
        }
      })
      .catch(() => {
        console.warn('[CaltDHy] Offline mode: dùng dữ liệu từ localStorage cho budgets.');
      });

    // Fetch custom categories
    apiGetCustomCategories()
      .then(res => {
        if (res?.success && Array.isArray(res.data)) {
          const parsed = res.data.map(name => ({
            name: name.trim(),
            type: DEFAULT_INCOME_CATS.includes(name) ? 'income' : 'expense'
          }));
          setCustomCategoriesRaw(parsed);
        }
      })
      .catch(() => {
        console.warn('[CaltDHy] Offline mode: dùng dữ liệu từ localStorage cho categories.');
      })
      .finally(() => setSyncing(false));
  }, []);


  // ── getAllCategories: default + custom, trừ hidden ──
  const getAllCategories = useCallback(() => {
    const base = DEFAULT_CATEGORIES.filter(c => !hiddenDefaultCategories.includes(c));
    customCategories.forEach(c => { if (!base.includes(c.name)) base.push(c.name); });
    if (categoryOrder.length > 0) {
      base.sort((a, b) => {
        const ia = categoryOrder.indexOf(a);
        const ib = categoryOrder.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    return base;
  }, [customCategories, hiddenDefaultCategories, categoryOrder]);

  const getCategoryType = useCallback((catName) => {
    if (DEFAULT_INCOME_CATS.includes(catName)) return 'income';
    const found = customCategories.find(c => c.name === catName);
    return found ? found.type : 'expense';
  }, [customCategories]);

  // ── CRUD Transactions ──
  const addTransaction = useCallback(async (txn) => {
    const newTxn = { ...txn, _id: crypto.randomUUID(), date: txn.date || new Date().toISOString() };
    setTransactions(prev => [newTxn, ...prev]);
    try { await apiAddTransaction(txn); } catch { /* offline: đã lưu local */ }
    return newTxn;
  }, []);

  const updateTransaction = useCallback(async (id, patch) => {
    setTransactions(prev => prev.map(t => t._id === id ? { ...t, ...patch } : t));
    try { await apiUpdateTransaction(id, patch); } catch {}
  }, []);

  const deleteTransaction = useCallback(async (id) => {
    setTransactions(prev => prev.filter(t => t._id !== id));
    try { await apiDeleteTransaction(id); } catch {}
  }, []);

  // ── Budgets ──
  const setBudget = useCallback((cat, amount) => {
    setBudgets(prev => {
      const updated = { ...prev, [cat]: amount };
      apiUpdateBudgets(updated).catch(() => {});
      return updated;
    });
  }, []);

  const saveAllBudgets = useCallback(async (newBudgets) => {
    setBudgets(newBudgets);
    try {
      await apiUpdateBudgets(newBudgets);
    } catch {}
  }, []);

  // ── Custom Categories ──
  const addCustomCategory = useCallback((name, type) => {
    if (!name?.trim()) return;
    const cleanName = name.trim();
    setCustomCategoriesRaw(prev => {
      if (prev.find(c => c.name === cleanName)) return prev;
      const updated = [...prev, { name: cleanName, type }];
      const names = updated.map(c => c.name);
      apiUpdateCustomCategories(names).catch(() => {});
      return updated;
    });
  }, []);

  const removeCustomCategory = useCallback((name) => {
    setCustomCategoriesRaw(prev => {
      const updated = prev.filter(c => c.name !== name);
      const names = updated.map(c => c.name);
      apiUpdateCustomCategories(names).catch(() => {});
      return updated;
    });
  }, []);


  // ── Computed: tổng thu, chi ──
  const getTotals = useCallback((txns = transactions, mode = balanceResetMode) => {
    const filtered = mode === 'reset'
      ? txns.filter(t => {
          const d = new Date(t.date);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
      : txns;

    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [transactions, balanceResetMode]);

  return {
    transactions, setTransactions,
    budgets, setBudget, saveAllBudgets,
    customCategories, addCustomCategory, removeCustomCategory,
    hiddenDefaultCategories, setHiddenDefault,
    categoryOrder, setCategoryOrder,
    balanceResetMode, setBalanceResetMode,
    syncing,
    getAllCategories, getCategoryType,
    addTransaction, updateTransaction, deleteTransaction,
    getTotals,
  };
}
