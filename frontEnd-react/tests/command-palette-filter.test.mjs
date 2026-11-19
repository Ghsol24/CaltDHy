import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterCommands, matchScore, moveIndex, normalizeSearch, parseAmount, parseRecordIntent,
} from '../src/components/ui/commandPaletteFilter.js';

const cmd = (id, group, label, extra = {}) => ({ id, group, label, ...extra });
const ids = (groups) => groups.map(({ group, items }) => `${group}:${items.map((item) => item.id).join(',')}`);

const COMMANDS = [
  cmd('add-expense', 'record', 'Thêm khoản chi', { keywords: ['them ghi chep', 'chi tieu tra mua'] }),
  cmd('add-income', 'record', 'Thêm khoản thu', { keywords: ['them ghi chep', 'thu nhap luong'] }),
  cmd('theme', 'other', 'Đổi theme', { emptyOnly: true, keywords: ['giao dien'] }),
  cmd('theme-dark', 'other', 'Theme Tối', { queryOnly: true, keywords: ['Đổi theme', 'giao dien'] }),
  cmd('goto-budgets', 'goto', 'Ngân sách', { detail: 'Kế hoạch', keywords: ['Kế hoạch'] }),
  cmd('goto-wallets', 'goto', 'Ví & Tài khoản', { detail: 'Kế hoạch', keywords: ['Kế hoạch'] }),
  cmd('edit-budgets', 'other', 'Sửa hạn mức', { keywords: ['ngan sach han muc'] }),
];

test('normalizeSearch drops diacritics, đ and extra spaces', () => {
  assert.equal(normalizeSearch('  Cà   Phê  '), 'ca phe');
  assert.equal(normalizeSearch('Đổi ĐIỀU'), 'doi dieu');
  assert.equal(normalizeSearch(null), '');
});

test('matchScore needs every word and prefers a label that starts with the query', () => {
  const budgets = COMMANDS[4];
  assert.equal(matchScore(budgets, 'ngan'), 4);
  assert.equal(matchScore(budgets, 'sách'), 3);
  assert.equal(matchScore(budgets, 'ngân kế'), 1); // second word only in the group name
  assert.equal(matchScore(budgets, 'ngân ví'), 0);
  assert.equal(matchScore(budgets, ''), 1);
});

test('filterCommands keeps group order before typing and hides query-only rows', () => {
  assert.deepEqual(ids(filterCommands(COMMANDS, '')), [
    'record:add-expense,add-income', 'goto:goto-budgets,goto-wallets', 'other:theme,edit-budgets',
  ]);
});

test('filterCommands puts the group with the best match first once typing', () => {
  // "ngân sách" is the page name, and only a keyword of "Sửa hạn mức".
  assert.deepEqual(ids(filterCommands(COMMANDS, 'ngân sách')), ['goto:goto-budgets', 'other:edit-budgets']);
  // Typing swaps the "Đổi theme" shortcut for one row per theme.
  assert.deepEqual(ids(filterCommands(COMMANDS, 'đổi theme')), ['other:theme-dark']);
  assert.deepEqual(filterCommands(COMMANDS, 'xyz'), []);
});

test('pinned rows skip matching and use their own score', () => {
  const typed = [
    ...COMMANDS,
    cmd('search-text', 'search', 'Giao dịch có "cà phê"', { pinned: true, score: 0.5 }),
    cmd('record-typed', 'record', 'Thêm khoản chi "cà phê"', { pinned: true }),
  ];
  assert.deepEqual(ids(filterCommands(typed, 'chi cà phê')), ['record:record-typed', 'search:search-text']);
  // The free-text search row never outranks a command that really matches.
  const searchOnly = typed.filter((command) => command.id !== 'record-typed');
  assert.deepEqual(ids(filterCommands(searchOnly, 'đổi theme')), ['other:theme-dark', 'search:search-text']);
});

test('parseAmount reads k / tr shorthands and grouped digits', () => {
  assert.equal(parseAmount('50k'), 50000);
  assert.equal(parseAmount('1,5tr'), 1500000);
  assert.equal(parseAmount('1.5TR'), 1500000);
  assert.equal(parseAmount('2triệu'), 2000000);
  assert.equal(parseAmount('120.000'), 120000);
  assert.equal(parseAmount('35000'), 35000);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('cf'), null);
});

test('parseRecordIntent turns "chi 50k cà phê" into a new expense', () => {
  assert.deepEqual(parseRecordIntent('chi cà phê'), { type: 'expense', amount: null, desc: 'cà phê' });
  assert.deepEqual(parseRecordIntent('Thêm chi 50k Cà phê sữa'), { type: 'expense', amount: 50000, desc: 'Cà phê sữa' });
  assert.deepEqual(parseRecordIntent('thu 2tr lương'), { type: 'income', amount: 2000000, desc: 'lương' });
  assert.deepEqual(parseRecordIntent('spend 30k lunch'), { type: 'expense', amount: 30000, desc: 'lunch' });
  assert.deepEqual(parseRecordIntent('chi'), { type: 'expense', amount: null, desc: '' });
  assert.equal(parseRecordIntent('xem chi tiêu'), null);
  assert.equal(parseRecordIntent('ngân sách'), null);
  assert.equal(parseRecordIntent(''), null);
});

test('moveIndex wraps at both ends', () => {
  assert.equal(moveIndex(0, -1, 3), 2);
  assert.equal(moveIndex(2, 1, 3), 0);
  assert.equal(moveIndex(-1, 1, 3), 0);
  assert.equal(moveIndex(-1, -1, 3), 2);
  assert.equal(moveIndex(0, 1, 0), -1);
});
