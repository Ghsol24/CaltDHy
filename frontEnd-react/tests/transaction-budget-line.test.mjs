import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORY_CHIP_SLOTS, describeBudgetLine, pickVisibleCategories } from '../src/features/transactions/modal/transactionModalHelpers.js';
import { getBudgetLineCopy } from '../src/features/transactions/transactionBudgetCopy.js';

const copy = getBudgetLineCopy('vi');
const formatMoney = (raw) => `${Number(raw)} ₫`;
const metric = (remaining) => ({ hasLimit: true, rawRemaining: BigInt(remaining) });
const line = (args) => describeBudgetLine({ copy, formatMoney, limit: 'hạn mức tháng này', category: 'Ăn uống', ...args });

test('budget line is red only when this entry pushes a category over its limit', () => {
  // Chưa nhập số tiền: chỉ nói còn bao nhiêu, kể cả khi danh mục sắp hết.
  assert.deepEqual(line({ metric: metric(1401000), baseline: metric(1401000), hasDraft: false }),
    { text: 'Ăn uống: còn 1401000 ₫ hạn mức tháng này', kind: 'left' });
  // Đã nhập số tiền vẫn trong hạn mức: nói còn lại sau khoản này, không đỏ.
  assert.equal(line({ metric: metric(1201000), baseline: metric(1401000), hasDraft: true }).tone, undefined);
  assert.equal(line({ metric: metric(1201000), baseline: metric(1401000), hasDraft: true }).kind, 'after');
  // Khoản này làm vượt: đỏ, nói số vượt.
  const exceed = line({ metric: metric(-598000), baseline: metric(1401000), hasDraft: true });
  assert.equal(exceed.tone, 'danger');
  assert.equal(exceed.text, 'Ăn uống: khoản này làm vượt hạn mức 598000 ₫');
});

test('a category that was already over stays neutral whatever is typed', () => {
  const before = line({ metric: metric(-273000), baseline: metric(-273000), hasDraft: false });
  const typed = line({ metric: metric(-5273000), baseline: metric(-273000), hasDraft: true });
  assert.equal(before.tone, undefined);
  assert.equal(typed.tone, undefined);
  assert.equal(typed.text, 'Ăn uống: đã vượt 273000 ₫ hạn mức tháng này');
});

test('budget line follows both the amount and the category, in either order', () => {
  // Thứ tự 1: chọn danh mục rồi gõ số; thứ tự 2: gõ số rồi đổi danh mục. Kết quả chỉ phụ thuộc cặp (danh mục, số tiền).
  const eating = { metric: metric(-100), baseline: metric(900), hasDraft: true };
  const coffee = { metric: metric(5000), baseline: metric(5000), hasDraft: true, category: 'Coffee' };
  assert.equal(line(eating).tone, 'danger');
  assert.equal(line(coffee).tone, undefined);
  assert.match(line(coffee).text, /^Coffee: /);
});

test('budget line copes with unset limits, used-up limits and missing data', () => {
  assert.equal(line({ metric: { hasLimit: false }, hasDraft: false }).kind, 'unset');
  assert.equal(line({ metric: metric(0), baseline: metric(0), hasDraft: false }).kind, 'reached');
  assert.equal(line({ metric: undefined, hasDraft: true }).text, '');
  // Điện thoại không ghi tên danh mục (đã có ở dòng chọn): câu viết hoa đầu.
  assert.equal(describeBudgetLine({ copy, formatMoney, limit: 'hạn mức tháng này', metric: metric(10), baseline: metric(10), hasDraft: false }).text,
    'Còn 10 ₫ hạn mức tháng này');
});

test('the category chip grid shows 10 chips or 9 + "Thêm…" and always keeps the chosen category visible', () => {
  const names = (count) => Array.from({ length: count }, (_, index) => ({ name: `C${index + 1}` }));
  assert.equal(pickVisibleCategories(names(CATEGORY_CHIP_SLOTS), 'C3').hasMore, false);
  assert.equal(pickVisibleCategories(names(CATEGORY_CHIP_SLOTS), 'C3').visible.length, CATEGORY_CHIP_SLOTS);
  const many = pickVisibleCategories(names(14), 'c12');
  assert.equal(many.hasMore, true);
  assert.equal(many.visible.length, CATEGORY_CHIP_SLOTS - 1);
  assert.equal(many.visible.at(-1).name, 'C12');
  assert.deepEqual(pickVisibleCategories(names(14), 'C2').visible.map((cat) => cat.name), names(9).map((cat) => cat.name));
});
