import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplayDate, isoFromParts, parseIsoDate, parseTypedDate } from '../src/utils/datePicker.js';

test('typed dates accept Vietnamese day-first input and ISO input', () => {
  assert.equal(parseTypedDate('28/10/2026'), '2026-10-28');
  assert.equal(parseTypedDate('1/2/2027'), '2027-02-01');
  assert.equal(parseTypedDate('28-10-2026'), '2026-10-28');
  assert.equal(parseTypedDate('28.10.2026'), '2026-10-28');
  assert.equal(parseTypedDate('28102026'), '2026-10-28');
  assert.equal(parseTypedDate('2026-10-28'), '2026-10-28');
  assert.equal(parseTypedDate('2026/10/28'), '2026-10-28');
});

test('typed dates reject impossible calendar days instead of rolling over', () => {
  assert.equal(parseTypedDate('31/02/2026'), null);
  assert.equal(parseTypedDate('29/02/2026'), null);
  assert.equal(parseTypedDate('29/02/2028'), '2028-02-29');
  assert.equal(parseTypedDate('00/10/2026'), null);
  assert.equal(parseTypedDate('12/13/2026'), null);
  assert.equal(parseTypedDate('abc'), null);
  assert.equal(parseTypedDate('28/10/26'), null);
});

test('empty text clears the date', () => {
  assert.equal(parseTypedDate(''), '');
  assert.equal(parseTypedDate('   '), '');
});

test('ISO parsing and display formatting round-trip', () => {
  assert.deepEqual(parseIsoDate('2026-10-28'), { year: 2026, month: 9, day: 28 });
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate(''), null);
  assert.equal(formatDisplayDate('2026-10-28'), '28/10/2026');
  assert.equal(formatDisplayDate('2026-10-28', 'ymd'), '2026/10/28');
  assert.equal(formatDisplayDate(''), '');
  assert.equal(isoFromParts(2026, 0, 31), '2026-01-31');
  assert.equal(isoFromParts(1850, 0, 1), null);
});
