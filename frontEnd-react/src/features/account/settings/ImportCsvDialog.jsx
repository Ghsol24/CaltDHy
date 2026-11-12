import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { spendingService } from '../../../services/spendingService';
import { useWalletStore } from '../../../stores/useWalletStore';
import { useTransactionStore } from '../../../stores/useTransactionStore';
import { useToastStore } from '../../../stores/useToastStore';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatCurrency, formatDate, getLocalDateString } from '../../../utils/formatters';
import { getUserErrorMessage } from '../../../utils/userErrors';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../../utils/categories';
import {
  IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, buildImportRows, guessColumns, parseCsv,
} from '../../../utils/csvImport';

const ERROR_REASONS = {
  date: 'ngày không đọc được',
  future: 'ngày ở tương lai',
  amount: 'số tiền không đọc được',
};
const PREVIEW_ROWS = 6;

export function ImportCsvDialog({ isOpen, onClose }) {
  const { label } = useTranslation();
  const wallets = useWalletStore((state) => state.wallets);
  const expenseCategories = useTransactionStore((state) => state.expenseCategories);
  const incomeCategories = useTransactionStore((state) => state.incomeCategories);
  const addToast = useToastStore((state) => state.addToast);
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState(null);
  const [walletId, setWalletId] = useState('');
  const [signMeaning, setSignMeaning] = useState('negativeIsExpense');
  const [expenseCategory, setExpenseCategory] = useState('Other Expense');
  const [incomeCategory, setIncomeCategory] = useState('Other Income');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const expenseOptions = (expenseCategories?.length ? expenseCategories : DEFAULT_EXPENSE_CATEGORIES).map((c) => c.name);
  const incomeOptions = (incomeCategories?.length ? incomeCategories : DEFAULT_INCOME_CATEGORIES).map((c) => c.name);
  const selectedWalletId = walletId || wallets[0]?.id || '';

  const result = useMemo(() => {
    if (!table || !mapping) return null;
    return buildImportRows(table.rows, mapping, {
      signMeaning, expenseCategory, incomeCategory, today: getLocalDateString(),
    });
  }, [table, mapping, signMeaning, expenseCategory, incomeCategory]);

  if (!isOpen) return null;

  const usesDebitCredit = mapping && mapping.debit >= 0 && mapping.credit >= 0;
  const mappingReady = mapping && mapping.date >= 0 && (mapping.amount >= 0 || usesDebitCredit);
  const tooManyRows = table && table.rows.length > IMPORT_MAX_ROWS;
  const canImport = Boolean(mappingReady && result && result.valid.length > 0 && result.errors.length === 0
    && !tooManyRows && selectedWalletId && !isImporting);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setTable(null); setMapping(null); setFileName(file.name);
    if (file.size > IMPORT_MAX_FILE_BYTES) { setError('File quá lớn. Hãy chọn file CSV nhỏ hơn 1MB.'); return; }
    let rows;
    try { rows = parseCsv(await file.text()); }
    catch { setError('Không thể đọc file này. Hãy chọn một file CSV.'); return; }
    if (rows.length < 2) { setError('File cần có dòng tiêu đề và ít nhất một dòng dữ liệu.'); return; }
    const [headers, ...dataRows] = rows;
    setTable({ headers, rows: dataRows });
    setMapping(guessColumns(headers));
  };

  const setColumn = (key, value) => setMapping((current) => ({ ...current, [key]: Number(value) }));

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true); setError('');
    try {
      const response = await spendingService.importTransactions({
        walletId: selectedWalletId,
        skipDuplicates,
        rows: result.valid.map(({ date, type, amount, category, desc }) => ({ date, type, amount, category, desc })),
      });
      const { imported = 0, skipped = 0 } = response.data || {};
      await Promise.all([
        useTransactionStore.getState().fetchTransactions?.(),
        useWalletStore.getState().fetchWallets?.(),
      ]);
      addToast({
        type: 'success',
        message: skipped > 0
          ? `Đã nhập ${imported} giao dịch, bỏ qua ${skipped} giao dịch đã có.`
          : `Đã nhập ${imported} giao dịch.`,
        duration: 5000,
      });
      onClose();
    } catch (err) {
      setError(getUserErrorMessage(err, 'error.save'));
    } finally {
      setIsImporting(false);
    }
  };

  const columnSelect = (key, title, required) => (
    <label className="account-import-field">
      <span>{title}</span>
      <select value={mapping[key]} onChange={(e) => setColumn(key, e.target.value)} disabled={isImporting}>
        <option value={-1}>{required ? 'Chọn cột...' : 'Không dùng'}</option>
        {table.headers.map((header, index) => (
          <option key={`${header}-${index}`} value={index}>{header || `Cột ${index + 1}`}</option>
        ))}
      </select>
    </label>
  );

  return (
    <Dialog
      isOpen
      onClose={onClose}
      busy={isImporting}
      closeOnBackdrop={false}
      portal={false}
      overlayClassName="account-reset-dialog-overlay"
      className="account-reset-dialog account-import-dialog"
      labelledBy="import-csv-title"
    >
      <h3 id="import-csv-title" className="account-import-title">Nhập giao dịch từ CSV</h3>
      <p className="account-import-hint">
        Dùng file CSV xuất từ ngân hàng hoặc bảng tính, có dòng tiêu đề. Tối đa 500 dòng mỗi lần. File chỉ được đọc trên thiết bị này trước khi bạn bấm nhập.
      </p>

      <div className="account-import-file-row">
        <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={handleFile} />
        <button type="button" className="btn-avatar-action btn-avatar-preset" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          {table ? 'Chọn file khác' : 'Chọn file CSV'}
        </button>
        {fileName && <span className="account-import-file-name" title={fileName}>{fileName}</span>}
      </div>

      {table && mapping && (
        <>
          <div className="account-import-grid">
            <label className="account-import-field">
              <span>Nhập vào ví</span>
              <select value={selectedWalletId} onChange={(e) => setWalletId(e.target.value)} disabled={isImporting}>
                {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
              </select>
            </label>
            {columnSelect('date', 'Cột ngày', true)}
            {columnSelect('amount', 'Cột số tiền', !usesDebitCredit)}
            {columnSelect('debit', 'Cột tiền chi (ghi nợ)', false)}
            {columnSelect('credit', 'Cột tiền thu (ghi có)', false)}
            {columnSelect('desc', 'Cột mô tả', false)}
            {columnSelect('category', 'Cột danh mục', false)}
            {!usesDebitCredit && (
              <label className="account-import-field">
                <span>Ý nghĩa của số tiền</span>
                <select value={signMeaning} onChange={(e) => setSignMeaning(e.target.value)} disabled={isImporting}>
                  <option value="negativeIsExpense">Số âm là chi, số dương là thu</option>
                  <option value="allExpense">Tất cả là khoản chi</option>
                  <option value="allIncome">Tất cả là khoản thu</option>
                </select>
              </label>
            )}
            <label className="account-import-field">
              <span>Danh mục cho khoản chi chưa phân loại</span>
              <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} disabled={isImporting}>
                {expenseOptions.map((name) => <option key={name} value={name}>{label(name)}</option>)}
              </select>
            </label>
            <label className="account-import-field">
              <span>Danh mục cho khoản thu chưa phân loại</span>
              <select value={incomeCategory} onChange={(e) => setIncomeCategory(e.target.value)} disabled={isImporting}>
                {incomeOptions.map((name) => <option key={name} value={name}>{label(name)}</option>)}
              </select>
            </label>
          </div>

          <label className="account-import-check">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} disabled={isImporting} />
            <span>Bỏ qua giao dịch đã có trong ví (cùng ngày, số tiền và mô tả)</span>
          </label>

          {!mappingReady && (
            <div className="account-feedback-msg error" role="alert">Hãy chọn cột ngày và cột số tiền để xem trước.</div>
          )}
          {tooManyRows && (
            <div className="account-feedback-msg error" role="alert">{`File có ${table.rows.length} dòng. Hãy tách thành các file tối đa 500 dòng.`}</div>
          )}

          {mappingReady && result && (
            <div className="account-import-preview" aria-live="polite">
              <strong>{`Sẵn sàng nhập ${result.valid.length} giao dịch`}</strong>
              {result.valid.length > 0 && (
                <div className="account-import-table-wrap">
                  <table className="account-import-table">
                    <thead>
                      <tr><th scope="col">Ngày</th><th scope="col">Mô tả</th><th scope="col">Danh mục</th><th scope="col">Số tiền</th></tr>
                    </thead>
                    <tbody>
                      {result.valid.slice(0, PREVIEW_ROWS).map((row) => (
                        <tr key={row.line}>
                          <td>{formatDate(row.date)}</td>
                          <td>{row.desc || '—'}</td>
                          <td>{label(row.category)}</td>
                          <td className={row.type === 'income' ? 'is-income' : 'is-expense'}>
                            {row.type === 'income' ? '+' : '−'}{formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.valid.length > PREVIEW_ROWS && <span className="account-import-more">{`và ${result.valid.length - PREVIEW_ROWS} giao dịch khác`}</span>}
              {result.errors.length > 0 && (
                <div className="account-feedback-msg error" role="alert">
                  <span>{`${result.errors.length} dòng chưa đọc được. Sửa file hoặc đổi cột rồi thử lại; chưa có gì được nhập.`}</span>
                  <ul className="account-import-errors">
                    {result.errors.slice(0, 5).map((item) => (
                      <li key={item.line}>{`Dòng ${item.line}: ${ERROR_REASONS[item.reason]}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && <div className="account-feedback-msg error" role="alert">{error}</div>}

      <div className="account-reset-actions">
        <Button variant="secondary" size="lg" onClick={onClose} disabled={isImporting}>Hủy</Button>
        <Button variant="primary" size="lg" disabled={!canImport} loading={isImporting} onClick={handleImport}>
          {isImporting ? 'Đang nhập...' : 'Nhập giao dịch'}
        </Button>
      </div>
    </Dialog>
  );
}
