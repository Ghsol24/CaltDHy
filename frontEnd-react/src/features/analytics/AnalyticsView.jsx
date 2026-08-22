import React, { useEffect, useMemo, useState } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { spendingService } from '../../services/spendingService';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

export function AnalyticsView() {
  const { transactions } = useTransactionStore();
  const [budgets, setBudgets] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const currentPrefix = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    spendingService.getBudgets().then((data) => setBudgets(data.data || {})).catch(() => setMessage('Không thể tải ngân sách khi đang ngoại tuyến.'));
  }, []);

  const summary = useMemo(() => {
    const current = transactions.filter((item) => item.date?.startsWith(currentPrefix));
    const income = current.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = current.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const categories = current.filter((item) => item.type === 'expense').reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Number(item.amount || 0);
      return result;
    }, {});
    return { income, expense, net: income - expense, categories };
  }, [currentPrefix, transactions]);

  const allCategories = [...new Set([...Object.keys(summary.categories), ...Object.keys(budgets)])].sort();
  const saveBudgets = async () => {
    setSaving(true);
    try {
      const cleaned = Object.fromEntries(Object.entries(budgets).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)]));
      const data = await spendingService.updateBudgets(cleaned);
      setBudgets(data.data || cleaned);
      setMessage('Đã lưu ngân sách.');
    } catch (error) { setMessage(error.message || 'Không thể lưu ngân sách.'); }
    finally { setSaving(false); }
  };

  return <div className="analytics-view" style={{ padding: '20px 0', display: 'grid', gap: 20 }}>
    <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      {[['Thu nhập tháng', summary.income, 'var(--green)'], ['Chi tiêu tháng', summary.expense, 'var(--accent)'], ['Dòng tiền ròng', summary.net, summary.net >= 0 ? 'var(--green)' : 'var(--accent)']].map(([label, value, color]) => <div className="chassis-frame" key={label}><div className="chassis-frame__inner"><p style={{ color: 'var(--muted)', margin: 0 }}>{label}</p><strong style={{ fontSize: 21, color }}>{money(value)}</strong></div></div>)}
    </section>
    <section className="chassis-frame"><div className="chassis-frame__inner"><h2 style={{ marginTop: 0 }}>📊 Chi tiêu theo danh mục</h2>
      {Object.keys(summary.categories).length === 0 ? <p style={{ color: 'var(--muted)' }}>Chưa có chi tiêu trong tháng này.</p> : Object.entries(summary.categories).sort(([, a], [, b]) => b - a).map(([category, amount]) => <div key={category} style={{ margin: '12px 0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{category}</span><strong>{money(amount)}</strong></div><div style={{ height: 8, background: 'var(--recessed)', borderRadius: 8, marginTop: 6 }}><div style={{ height: '100%', width: `${Math.max(4, (amount / summary.expense) * 100)}%`, background: 'var(--accent)', borderRadius: 8 }} /></div></div>)}
    </div></section>
    <section className="chassis-frame"><div className="chassis-frame__inner"><h2 style={{ marginTop: 0 }}>🎯 Ngân sách tháng</h2>
      {allCategories.length === 0 ? <p style={{ color: 'var(--muted)' }}>Hãy ghi một khoản chi hoặc tạo ngân sách từ giao diện web cũ để bắt đầu.</p> : <div style={{ display: 'grid', gap: 12 }}>{allCategories.map((category) => { const spent = summary.categories[category] || 0; const limit = Number(budgets[category] || 0); const percent = limit ? Math.min(100, (spent / limit) * 100) : 0; return <div key={category} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 140px', gap: 10, alignItems: 'center' }}><div><strong>{category}</strong><br /><small style={{ color: 'var(--muted)' }}>{money(spent)} {limit ? `/ ${money(limit)}` : '· chưa đặt hạn mức'}</small><div style={{ height: 6, background: 'var(--recessed)', borderRadius: 6, marginTop: 5 }}><div style={{ height: '100%', width: `${percent}%`, background: percent >= 100 ? 'var(--accent)' : 'var(--green)', borderRadius: 6 }} /></div></div><input className="finput" type="number" min="0" placeholder="Hạn mức" value={budgets[category] || ''} onChange={(event) => setBudgets({ ...budgets, [category]: event.target.value })} /></div>; })}</div>}
      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}><button className="btn-cta" type="button" onClick={saveBudgets} disabled={saving}>{saving ? 'ĐANG LƯU...' : 'LƯU NGÂN SÁCH'}</button>{message && <span role="status" style={{ color: 'var(--muted)' }}>{message}</span>}</div>
    </div></section>
  </div>;
}
