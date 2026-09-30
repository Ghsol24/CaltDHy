import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvRow } from '../src/utils/csv.js';

// An independent CSV reader ensures hostile delimiters cannot create extra cells.
function readRow(source) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { cells.push(cell); cell = ''; }
    else if (!quoted && char === '\n') { cells.push(cell); return cells; }
    else cell += char;
  }
  throw new Error('CSV row is not terminated');
}

test('CSV export neutralizes spreadsheet formulas and leading control characters', () => {
  for (const text of ['=1+1', '+1+1', '-1+1', '@SUM(A1:A2)', ' =1+1', '\t=1+1',
    '\r=1+1', '\n=1+1', '\u0000=1+1', '＝1+1', '＋1+1', '－1+1', '＠SUM(A1:A2)']) {
    assert.deepEqual(readRow(csvRow([text, 123])), ["'" + text, '123']);
  }
});

test('CSV export contains attacker quotes, separators and newlines in a single cell', () => {
  for (const text of ['CSV audit",=1+1,"next', 'two,columns', 'two;columns',
    'category"\r\n=1+1,"next', 'Ghi chú "tiền mặt"\năn uống']) {
    assert.deepEqual(readRow(csvRow([text, 123, 'last'])), [text, '123', 'last']);
  }
});

test('CSV escaping preserves ordinary text, financial numbers and empty cells', () => {
  assert.deepEqual(readRow(csvRow(['Ăn uống', 1000, -500, 0, 123n, '-20.5%', null, undefined])),
    ['Ăn uống', '1000', '-500', '0', '123', '-20.5%', '', '']);
  assert.equal(csvCell('"quoted"'), '"""quoted"""');
});
