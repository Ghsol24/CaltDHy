import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectJarEvents, summariseDays, monthTotals, compareWithPreviousMonth, savingStreak,
  monthWeeks, yearColumns, intensityLevel, elapsedDays, shiftMonth
} from '../src/features/jars/jarActivity.js';

// Mirrors the October data in the screenshots: 4 active days, +2,000,000 net.
const jars = [
  { id: 'health', name: 'Sức khoẻ', history: [{ id: 'a', type: 'deposit', amount: 1500000, date: '2026-10-02' }] },
  { id: 'travel', name: 'Du Lịch', history: [
    { id: 'b', type: 'deposit', amount: 1000000, date: '2026-10-11' },
    { id: 'c', type: 'withdraw', amount: 765000, date: '2026-10-19' },
    { id: 'd', type: 'withdraw', amount: 5000, date: '2026-10-19' },
    { id: 'e', type: 'withdraw', amount: 100000, date: '2026-10-19' },
    { id: 'f', type: 'deposit', amount: 370000, date: '2026-10-26' },
    { id: 'g', type: 'note', amount: 999, date: '2026-10-27' },
    { id: 'h', type: 'deposit', amount: 0, date: '2026-10-27' }
  ] }
];

test('events come only from real deposit and withdrawal history', () => {
  const events = collectJarEvents(jars);
  assert.equal(events.length, 6);
  assert.equal(events[0].day, '2026-10-26');
  assert.equal(events.find((e) => e.id === 'c').signed, -765000);
});

test('month totals give the real net saving and best day', () => {
  const days = summariseDays(collectJarEvents(jars));
  const october = monthTotals(days, '2026-10');
  assert.equal(october.net, 2000000);
  assert.equal(october.activeDays, 4);
  assert.deepEqual(october.best, { day: '2026-10-02', net: 1500000 });
  assert.deepEqual(days.get('2026-10-19'), { deposit: 0, withdraw: 870000, net: -870000, count: 3 });
});

test('month-over-month comparison never invents a percentage', () => {
  const days = summariseDays(collectJarEvents(jars));
  assert.deepEqual(compareWithPreviousMonth(days, '2026-10'), { previous: 0, current: 2000000, percent: null });
  const withSeptember = summariseDays(collectJarEvents([...jars, { id: 'x', history: [{ type: 'deposit', amount: 1600000, date: '2026-09-05' }] }]));
  assert.equal(compareWithPreviousMonth(withSeptember, '2026-10').percent, 25);
});

test('streak counts consecutive saving days only', () => {
  const days = summariseDays(collectJarEvents(jars));
  assert.equal(savingStreak(days, '2026-10-28'), 0);
  assert.equal(savingStreak(days, '2026-10-26'), 1);
  assert.equal(savingStreak(days, '2026-10-27'), 1);
  const run = summariseDays(collectJarEvents([{ id: 'r', history: ['2026-10-25', '2026-10-26', '2026-10-27'].map((date) => ({ type: 'deposit', amount: 10, date })) }]));
  assert.equal(savingStreak(run, '2026-10-27'), 3);
  assert.equal(savingStreak(run, '2026-10-28'), 3);
});

test('calendar grids are Monday-first and cover the whole month', () => {
  const weeks = monthWeeks('2026-10');
  assert.equal(weeks[0][0].day, '2026-09-28');
  assert.equal(weeks[0][3].day, '2026-10-01');
  assert.equal(weeks.at(-1).at(-1).day, '2026-11-01');
  assert.equal(weeks.flat().filter((cell) => cell.inMonth).length, 31);
  const columns = yearColumns('2026-10-28');
  assert.equal(columns.length, 53);
  assert.equal(columns.at(-1)[0].day, '2026-10-26');
  assert.equal(columns.at(-1)[2].day, '2026-10-28');
  assert.equal(columns.at(-1)[3].future, true);
});

test('helpers for averages, months and intensity', () => {
  assert.equal(elapsedDays('2026-10', '2026-10-28'), 28);
  assert.equal(elapsedDays('2026-09', '2026-10-28'), 30);
  assert.equal(elapsedDays('2026-11', '2026-10-28'), 0);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(intensityLevel(0, 100), 0);
  assert.equal(intensityLevel(-5, 100), 0);
  assert.equal(intensityLevel(100, 100), 4);
  assert.equal(intensityLevel(10, 100), 1);
});
