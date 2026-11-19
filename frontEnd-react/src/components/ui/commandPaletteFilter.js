// Pure helpers behind the command palette (NAV-12): matching, ordering and
// reading "chi 50k cà phê" as a new expense. No React, no stores, so
// tests/command-palette-filter.test.mjs can exercise them directly.

export const COMMAND_GROUPS = Object.freeze(['record', 'search', 'goto', 'period', 'other']);

/** Lower case, no diacritics, "đ" → "d", single spaces: "Cà  Phê" → "ca phe". */
export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How well `command` matches `query` (higher is better), or 0 when it does not.
 * Every word of the query must appear in the label or the keywords; a label
 * that starts with the query beats one that only contains it.
 */
export function matchScore(command, query) {
  const needle = normalizeSearch(query);
  if (!needle) return 1;
  const label = normalizeSearch(command.label);
  const haystack = [label, normalizeSearch(command.detail), ...(command.keywords || []).map(normalizeSearch)].join(' ');
  const words = needle.split(' ');
  if (!words.every((word) => haystack.includes(word))) return 0;
  if (label.startsWith(needle)) return 4;
  if (label.includes(needle)) return 3;
  if (words.every((word) => label.split(' ').some((part) => part.startsWith(word)))) return 2;
  return 1;
}

/**
 * Commands to show for `query`, grouped in COMMAND_GROUPS order and sorted by
 * score inside each group. `emptyOnly` commands show only before typing (a
 * short way in, e.g. "Đổi theme"); `queryOnly` ones only once something is typed
 * (one row per theme or jar would crowd the opening list).
 */
export function filterCommands(commands, query) {
  const typed = normalizeSearch(query) !== '';
  const groups = [];
  for (const group of COMMAND_GROUPS) {
    const entries = commands
      .filter((command) => command.group === group && !(typed ? command.emptyOnly : command.queryOnly))
      // `pinned` rows are built from the query itself, so they skip matching and carry their own score.
      .map((command, index) => ({ command, index, score: command.pinned ? (command.score ?? 9) : matchScore(command, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    if (entries.length) groups.push({ group, best: entries[0].score, items: entries.map((entry) => entry.command) });
  }
  // Once something is typed, the group holding the best match comes first ("ngân sách" → the page,
  // not a search for the words); ties keep COMMAND_GROUPS order.
  if (typed) groups.sort((a, b) => b.best - a.best);
  return groups.map(({ group, items }) => ({ group, items }));
}

const UNITS = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, m: 1e6 };
const AMOUNT = /^(\d+(?:[.,]\d+)*)(k|nghin|ngan|tr|trieu|m)?$/;

/** "50k" → 50000, "1,5tr" → 1500000, "120.000" → 120000; anything else → null. */
export function parseAmount(token) {
  const match = AMOUNT.exec(normalizeSearch(token));
  if (!match) return null;
  const [, digits, unit] = match;
  // With a unit the separator is a decimal point ("1,5tr"); without one it groups thousands ("120.000").
  const value = unit
    ? Number(digits.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) * UNITS[unit]
    : Number(digits.replace(/[.,]/g, ''));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

const VERBS = {
  chi: 'expense', spend: 'expense', spent: 'expense', expense: 'expense', '支出': 'expense',
  thu: 'income', income: 'income', earn: 'income', earned: 'income', '收入': 'income',
};
const LEADING = new Set(['them', 'add', 'ghi', '添加']);

/**
 * Reads a typed note as a transaction to record: "chi cà phê" →
 * { type: 'expense', desc: 'cà phê' }, "thu 2tr lương" → { type: 'income',
 * amount: 2000000, desc: 'lương' }. Returns null unless it starts with chi/thu
 * (or spend/income), optionally after "thêm"/"add".
 */
export function parseRecordIntent(query) {
  const words = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length && LEADING.has(normalizeSearch(words[0]))) words.shift();
  const type = VERBS[normalizeSearch(words[0])];
  if (!type) return null;
  let amount = null;
  const rest = words.slice(1).filter((word) => {
    if (amount !== null) return true;
    const value = parseAmount(word);
    if (value === null) return true;
    amount = value;
    return false;
  });
  return { type, amount, desc: rest.join(' ') };
}

/** Index of the next row when moving by `delta`, wrapping at both ends. */
export function moveIndex(current, delta, count) {
  if (count <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}
