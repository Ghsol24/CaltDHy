import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImportRows, guessColumns, parseCsv, parseCsvDate, parseVndAmount } from '../src/utils/csvImport.js';

test('CSV parsing handles BOM, quotes, embedded delimiters and semicolon files', () => {
  assert.deepEqual(parseCsv('﻿Ngày,Mô tả,Số tiền\r\n21/09/2026,"Ăn trưa, cà phê","-50,000"\n\n'), [
    ['Ngày', 'Mô tả', 'Số tiền'], ['21/09/2026', 'Ăn trưa, cà phê', '-50,000'],
  ]);
  assert.deepEqual(parseCsv('date;desc;amount\n2026-09-21;"He said ""hi""";1.000'), [
    ['date', 'desc', 'amount'], ['2026-09-21', 'He said "hi"', '1.000'],
  ]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv(''), []);
});

test('VND amounts are read exactly or rejected, never guessed', () => {
  for (const [raw, expected] of [
    ['50000', 50000], ['1.234.567', 1234567], ['1,234,567', 1234567], ['1.234.567,00', 1234567],
    ['1,234,567.00', 1234567], ['-50.000', -50000], ['(50.000)', -50000], ['50.000 ₫', 50000],
    ['+200,000 VND', 200000], ['1.234', 1234], ['1,234', 1234], ['12,00', 12], ['50000-', -50000], ['1 234 567đ', 1234567],
  ]) assert.equal(parseVndAmount(raw), expected, raw);
  for (const raw of ['', '0', '50k', '12.5', '1,234.56', '1.234,5', 'abc', '1.23.456', '12.3456.789', '--5', '9'.repeat(17)]) {
    assert.equal(parseVndAmount(raw), null, raw);
  }
});

test('dates accept ISO and day-first formats and reject impossible days', () => {
  assert.equal(parseCsvDate('2026-09-21'), '2026-09-21');
  assert.equal(parseCsvDate('21/09/2026'), '2026-09-21');
  assert.equal(parseCsvDate('1-9-26'), '2026-09-01');
  assert.equal(parseCsvDate('21.09.2026 14:30:00'), '2026-09-21');
  assert.equal(parseCsvDate('2026-09-21T08:00:00Z'), '2026-09-21');
  for (const raw of ['', '31/02/2026', '2026-13-01', '09/21/2026', 'hôm qua']) assert.equal(parseCsvDate(raw), null, raw);
});

test('columns are guessed from Vietnamese, English and bank statement headers', () => {
  assert.deepEqual(guessColumns(['Ngày giao dịch', 'Diễn giải', 'Số tiền', 'Danh mục']),
    { date: 0, desc: 1, category: 3, debit: -1, credit: -1, amount: 2 });
  assert.deepEqual(guessColumns(['Date', 'Description', 'Debit', 'Credit', 'Balance']),
    { date: 0, desc: 1, category: -1, debit: 2, credit: 3, amount: -1 });
  assert.deepEqual(guessColumns(['Ngày', 'Nội dung', 'Ghi nợ']),
    { date: 0, desc: 1, category: -1, debit: -1, credit: -1, amount: 2 });
  assert.deepEqual(guessColumns(['x', 'y']), { date: -1, desc: -1, category: -1, debit: -1, credit: -1, amount: -1 });
});

test('rows become transactions with line-numbered errors and default categories', () => {
  const mapping = { date: 0, desc: 1, amount: 2, category: 3, debit: -1, credit: -1 };
  const { valid, errors } = buildImportRows([
    ['21/09/2026', 'Lunch', '-50.000', 'Food & Dining'],
    ['20/09/2026', 'Salary', '10.000.000', ''],
    ['bad', 'x', '1000', ''],
    ['22/09/2026', 'Future', '1000', ''],
    ['19/09/2026', 'Decimal', '12.5', ''],
  ], mapping, { today: '2026-09-21' });
  assert.deepEqual(valid, [
    { line: 2, date: '2026-09-21', type: 'expense', amount: 50000, category: 'Food & Dining', desc: 'Lunch' },
    { line: 3, date: '2026-09-20', type: 'income', amount: 10000000, category: 'Other Income', desc: 'Salary' },
  ]);
  assert.deepEqual(errors, [{ line: 4, reason: 'date' }, { line: 5, reason: 'future' }, { line: 6, reason: 'amount' }]);

  const allExpense = buildImportRows([['2026-09-21', 'Taxi', '80000']], { date: 0, desc: 1, amount: 2, category: -1, debit: -1, credit: -1 },
    { signMeaning: 'allExpense', expenseCategory: 'Transportation' });
  assert.deepEqual(allExpense.valid[0], { line: 2, date: '2026-09-21', type: 'expense', amount: 80000, category: 'Transportation', desc: 'Taxi' });
});

test('debit and credit columns pick the type and reject rows with both or neither', () => {
  const mapping = { date: 0, desc: 1, debit: 2, credit: 3, amount: -1, category: -1 };
  const { valid, errors } = buildImportRows([
    ['2026-09-21', 'ATM', '200,000', ''],
    ['2026-09-21', 'Refund', '0', '75,000'],
    ['2026-09-21', 'Both', '1,000', '1,000'],
    ['2026-09-21', 'None', '', ''],
  ], mapping);
  assert.deepEqual(valid.map(({ type, amount }) => [type, amount]), [['expense', 200000], ['income', 75000]]);
  assert.deepEqual(errors, [{ line: 4, reason: 'amount' }, { line: 5, reason: 'amount' }]);
});
