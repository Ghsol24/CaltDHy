// Pure helpers for the savings calendar and the recent-activity list on the
// Goals page. Everything is derived from the jars' real history entries only:
// no estimated or placeholder values are ever added.

const pad = (value) => String(value).padStart(2, '0');
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local calendar day (YYYY-MM-DD) for a history timestamp. */
export function localDayOf(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : isoOf(date);
}

export const monthOf = (day) => String(day || '').slice(0, 7);

export function shiftMonth(month, delta) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

const SIGN = { deposit: 1, initial: 1, withdraw: -1 };

/** Flatten every jar's history into dated, signed events (newest first). */
export function collectJarEvents(jars = []) {
  const events = [];
  for (const jar of Array.isArray(jars) ? jars : []) {
    for (const [index, entry] of (Array.isArray(jar?.history) ? jar.history : []).entries()) {
      const sign = SIGN[entry?.type];
      const amount = Number(entry?.amount) || 0;
      const day = localDayOf(entry?.date);
      if (!sign || amount <= 0 || !day) continue;
      events.push({
        id: entry.id || `${jar.id}-${index}`,
        jarId: jar.id,
        jarName: jar.name || '',
        jarColor: jar.color || null,
        type: entry.type === 'withdraw' ? 'withdraw' : 'deposit',
        amount,
        signed: sign * amount,
        reason: entry.reason || '',
        date: entry.date,
        day
      });
    }
  }
  return events.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.amount - a.amount);
}

/** Map of day → { deposit, withdraw, net, count }. */
export function summariseDays(events = []) {
  const days = new Map();
  for (const event of events) {
    const entry = days.get(event.day) || { deposit: 0, withdraw: 0, net: 0, count: 0 };
    if (event.type === 'withdraw') entry.withdraw += event.amount;
    else entry.deposit += event.amount;
    entry.net += event.signed;
    entry.count += 1;
    days.set(event.day, entry);
  }
  return days;
}

/** Totals for one month: net saved, deposits, withdrawals and active days. */
export function monthTotals(days, month) {
  let net = 0; let deposit = 0; let withdraw = 0; let activeDays = 0;
  let best = null;
  for (const [day, entry] of days) {
    if (monthOf(day) !== month) continue;
    net += entry.net; deposit += entry.deposit; withdraw += entry.withdraw; activeDays += 1;
    if (entry.net > 0 && (!best || entry.net > best.net)) best = { day, net: entry.net };
  }
  return { net, deposit, withdraw, activeDays, best };
}

/** Days of the month that count for a per-day average (up to today for the current month). */
export function elapsedDays(month, today = isoOf(new Date())) {
  const [year, index] = month.split('-').map(Number);
  const length = new Date(year, index, 0).getDate();
  if (month < monthOf(today)) return length;
  if (month > monthOf(today)) return 0;
  return Number(today.slice(8, 10));
}

/**
 * Compare a month's net saving with the month before.
 * Returns { previous, percent } where percent is null when there is no
 * positive baseline to compare against (so the UI never invents a figure).
 */
export function compareWithPreviousMonth(days, month) {
  const previous = monthTotals(days, shiftMonth(month, -1)).net;
  const current = monthTotals(days, month).net;
  if (previous <= 0) return { previous, current, percent: null };
  return { previous, current, percent: Math.round(((current - previous) / previous) * 100) };
}

/** Consecutive days with a positive net saving, ending today (or yesterday if today has none yet). */
export function savingStreak(days, today = isoOf(new Date())) {
  const cursor = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  if (!((days.get(isoOf(cursor))?.net || 0) > 0)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while ((days.get(isoOf(cursor))?.net || 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Monday-first weeks covering a month; cells outside the month are marked. */
export function monthWeeks(month) {
  const [year, index] = month.split('-').map(Number);
  const first = new Date(year, index - 1, 1);
  const start = new Date(year, index - 1, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(year, index, 0);
  const weeks = [];
  const cursor = new Date(start);
  while (cursor <= last) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push({ day: isoOf(cursor), date: cursor.getDate(), inMonth: cursor.getMonth() === index - 1 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** GitHub-style columns: `count` Monday-first weeks ending with the week of `endDay`. */
export function yearColumns(endDay, count = 53) {
  const end = new Date(Number(endDay.slice(0, 4)), Number(endDay.slice(5, 7)) - 1, Number(endDay.slice(8, 10)));
  const lastMonday = new Date(end);
  lastMonday.setDate(end.getDate() - ((end.getDay() + 6) % 7));
  const start = new Date(lastMonday);
  start.setDate(lastMonday.getDate() - (count - 1) * 7);
  const columns = [];
  const cursor = new Date(start);
  for (let column = 0; column < count; column += 1) {
    const cells = [];
    for (let row = 0; row < 7; row += 1) {
      cells.push({ day: isoOf(cursor), future: cursor > end });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(cells);
  }
  return columns;
}

/** Intensity level 1–4 for a positive day relative to the largest day in view. */
export function intensityLevel(net, maxNet) {
  if (!(net > 0) || !(maxNet > 0)) return 0;
  const ratio = net / maxNet;
  if (ratio > 0.66) return 4;
  if (ratio > 0.33) return 3;
  if (ratio > 0.12) return 2;
  return 1;
}
