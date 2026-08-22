import React, { useEffect, useState } from 'react';
import { useJarStore } from '../../stores/useJarStore';

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);

export function JarsView() {
  const store = useJarStore();
  const [jarForm, setJarForm] = useState({ name: '', target: '', targetDate: '', icon: '🫙', color: '#3498db' });
  const [installmentForm, setInstallmentForm] = useState({ name: '', amount: '', nextDueDate: today(), cycle: 'monthly', icon: '💳' });
  const [amounts, setAmounts] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => { useJarStore.getState().fetchData(); }, []);

  const withMessage = async (action, successMessage) => {
    try { await action(); setMessage(successMessage); } catch (error) { setMessage(error.message || 'Không thể hoàn tất thao tác.'); }
  };
  const createJar = (event) => {
    event.preventDefault();
    withMessage(async () => {
      await store.createJar({ ...jarForm, target: Number(jarForm.target), current: 0, targetDate: jarForm.targetDate || null });
      setJarForm({ name: '', target: '', targetDate: '', icon: '🫙', color: '#3498db' });
    }, 'Đã tạo hũ tiết kiệm.');
  };
  const transact = (id, action) => {
    const amount = Number(amounts[id]);
    if (!amount || amount <= 0) { setMessage('Vui lòng nhập số tiền hợp lệ.'); return; }
    withMessage(async () => {
      await store.updateJarBalance(id, action, amount, '');
      setAmounts((current) => ({ ...current, [id]: '' }));
    }, action === 'deposit' ? 'Đã nạp tiền vào hũ.' : 'Đã rút tiền từ hũ.');
  };
  const createInstallment = (event) => {
    event.preventDefault();
    withMessage(async () => {
      await store.createInstallment({ ...installmentForm, amount: Number(installmentForm.amount) });
      setInstallmentForm({ name: '', amount: '', nextDueDate: today(), cycle: 'monthly', icon: '💳' });
    }, 'Đã thêm khoản định kỳ.');
  };

  return <div style={{ padding: '20px 0', display: 'grid', gap: 20 }}>
    <section className="chassis-frame"><div className="chassis-frame__inner">
      <h2 style={{ marginTop: 0 }}>🏺 HŨ TIẾT KIỆM</h2>
      <form onSubmit={createJar} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <input className="finput" placeholder="Tên hũ" value={jarForm.name} onChange={(e) => setJarForm({ ...jarForm, name: e.target.value })} required />
        <input className="finput" type="number" min="1" placeholder="Mục tiêu (VNĐ)" value={jarForm.target} onChange={(e) => setJarForm({ ...jarForm, target: e.target.value })} required />
        <input className="finput" type="date" value={jarForm.targetDate} onChange={(e) => setJarForm({ ...jarForm, targetDate: e.target.value })} />
        <button className="btn-cta" type="submit">TẠO HŨ</button>
      </form>
    </div></section>
    {message && <p role="status" style={{ color: 'var(--muted)', margin: 0 }}>{message}</p>}
    {store.isLoading ? <p>Đang tải dữ liệu…</p> : <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
      {store.jars.map((jar) => {
        const percent = Math.min(100, Math.round((jar.current / jar.target) * 100));
        return <article key={jar.id} className="chassis-frame" style={{ borderTop: `3px solid ${jar.color || '#3498db'}` }}><div className="chassis-frame__inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><h3 style={{ margin: 0 }}>{jar.icon || '🫙'} {jar.name}</h3><button className="btn-ghost" onClick={() => withMessage(() => store.deleteJar(jar.id), 'Đã xóa hũ.')}>🗑</button></div>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{money(jar.current)} <span style={{ color: 'var(--muted)', fontSize: 13 }}>/ {money(jar.target)}</span></p>
          <div style={{ height: 8, background: 'var(--recessed)', borderRadius: 8 }}><div style={{ height: '100%', width: `${percent}%`, background: jar.color || 'var(--accent)', borderRadius: 8 }} /></div>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>{percent}% {jar.targetDate ? `· Mục tiêu ${jar.targetDate}` : ''}</p>
          <div style={{ display: 'flex', gap: 8 }}><input className="finput" type="number" min="1" placeholder="Số tiền" value={amounts[jar.id] || ''} onChange={(e) => setAmounts({ ...amounts, [jar.id]: e.target.value })} /><button className="btn-ghost" onClick={() => transact(jar.id, 'deposit')}>NẠP</button><button className="btn-ghost" onClick={() => transact(jar.id, 'withdraw')}>RÚT</button></div>
        </div></article>;
      })}
    </div>}
    <section className="chassis-frame"><div className="chassis-frame__inner">
      <h2 style={{ marginTop: 0 }}>💳 KHOẢN ĐỊNH KỲ</h2>
      <form onSubmit={createInstallment} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <input className="finput" placeholder="Tên khoản" value={installmentForm.name} onChange={(e) => setInstallmentForm({ ...installmentForm, name: e.target.value })} required />
        <input className="finput" type="number" min="1" placeholder="Số tiền" value={installmentForm.amount} onChange={(e) => setInstallmentForm({ ...installmentForm, amount: e.target.value })} required />
        <input className="finput" type="date" value={installmentForm.nextDueDate} onChange={(e) => setInstallmentForm({ ...installmentForm, nextDueDate: e.target.value })} required />
        <select className="finput" value={installmentForm.cycle} onChange={(e) => setInstallmentForm({ ...installmentForm, cycle: e.target.value })}><option value="monthly">Hàng tháng</option><option value="quarterly">Hàng quý</option><option value="yearly">Hàng năm</option></select>
        <button className="btn-cta" type="submit">THÊM KHOẢN</button>
      </form>
      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>{store.installments.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10, background: 'var(--recessed)', borderRadius: 8 }}><span>{item.icon || '💳'} <strong>{item.name}</strong><br /><small>{money(item.amount)} · đến hạn {item.nextDueDate}</small></span><span style={{ display: 'flex', gap: 6 }}><button className="btn-ghost" onClick={() => withMessage(() => store.payInstallment(item.id), 'Đã đánh dấu thanh toán.')}>ĐÃ TRẢ</button><button className="btn-ghost" onClick={() => withMessage(() => store.toggleInstallment(item.id), 'Đã cập nhật trạng thái.')}>{item.active ? 'TẠM DỪNG' : 'TIẾP TỤC'}</button><button className="btn-ghost" onClick={() => withMessage(() => store.deleteInstallment(item.id), 'Đã xóa khoản định kỳ.')}>🗑</button></span></div>)}</div>
    </div></section>
  </div>;
}
