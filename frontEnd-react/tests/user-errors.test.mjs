import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserErrorMessage, isSilentError, loadApiErrorMessages } from '../src/utils/userErrors.js';
import { translate } from '../src/i18n/translations.js';
import { apiMessages } from '../src/i18n/apiMessages.mjs';
import { useToastStore } from '../src/stores/useToastStore.js';

await loadApiErrorMessages();
const locales = ['vi', 'en', 'zh-CN'];

test('unknown exception and response text never reaches the display, even if it sounds friendly', () => {
  for (const locale of locales) {
    for (const value of [new TypeError("Cannot read properties of undefined (reading 'getPixelForValue')"),
      new Error('MongoServerError: private database connection'),
      { message: '<html>Bad Gateway nginx</html>', status: 502 },
      { message: 'Something unusual involving secret-state-123', status: 400 },
      'Random promise rejection detail', null, undefined, { message: { detail: 'private' } }]) {
      const message = getUserErrorMessage(value, 'error.save', locale);
      assert.ok(message);
      assert.doesNotMatch(message, /getPixelForValue|Mongo|nginx|secret-state|Random|private/);
    }
    assert.equal(getUserErrorMessage(new Error('unknown'), 'missing.key', locale), translate(locale, 'error.generic'));
  }
});

test('specific reviewed business validation survives errors and locale changes', () => {
  for (const locale of locales) {
    for (const message of ['Số dư ví không đủ hoặc vượt hạn mức tín dụng.', 'Email hoặc mật khẩu không đúng.',
      'Không thể đóng ví mặc định. Vui lòng chọn một ví khác làm mặc định trước.',
      'Hãy rút hết tiền về ví trước khi xóa hũ.']) {
      const expected = apiMessages[message][locales.indexOf(locale)];
      assert.equal(getUserErrorMessage({ message, status: 400 }, 'error.save', locale), expected);
      assert.equal(getUserErrorMessage(new Error(expected), 'error.save', locale), expected);
    }
  }
  const message = 'Hạn mức cho danh mục "Ăn uống" không được là số âm.';
  assert.equal(getUserErrorMessage(new Error(message)), message);
  const balance = 'Ví vẫn còn số dư (27.000 ₫). Vui lòng chọn ví nhận số dư trước khi đóng ví.';
  assert.equal(getUserErrorMessage(new Error(balance)), balance);
  assert.notEqual(getUserErrorMessage(new Error(message + '\nTypeError private')), message + '\nTypeError private');
});

test('internal API vocabulary is replaced in all three locales', () => {
  for (const locale of locales) {
    for (const source of ['Cần Idempotency-Key dạng UUID cho thao tác ghi.', 'Yêu cầu bị từ chối bởi chính sách bảo mật CORS.',
      'ID ví không hợp lệ.', 'API không tồn tại.', 'Tổng tài sản vượt miền số nguyên chính xác.',
      'Giao dịch chưa được xác nhận. Hãy thử lại với cùng mã yêu cầu.']) {
      const output = getUserErrorMessage(new Error(source), 'error.generic', locale);
      assert.doesNotMatch(output, /Idempotency|UUID|CORS|\bID\b|\bAPI\b|integer range|miền số nguyên|request key|密钥/);
      assert.notEqual(output, source);
    }
  }
});

test('recovery messages distinguish connection, unconfirmed write, authorization and throttling', () => {
  for (const locale of locales) {
    for (const [error, key] of [
      [{ code: 'NETWORK_ERROR' }, 'error.network'], [{ code: 'WRITE_UNCONFIRMED' }, 'error.writeUnconfirmed'],
      [{ code: 'TRANSACTION_FAILED', status: 503 }, 'error.writeUnconfirmed'], [{ code: 'TIMEOUT' }, 'error.timeout'],
      [{ code: 'INVALID_RESPONSE' }, 'error.invalidResponse'], [{ code: 'CSRF_INVALID' }, 'error.sessionRetry'],
      [{ status: 401 }, 'error.authExpired'], [{ status: 403 }, 'error.forbidden'],
      [{ status: 404 }, 'error.notFound'], [{ status: 429 }, 'error.tooManyRequests'], [{ status: 500 }, 'error.serviceUnavailable'],
    ]) assert.equal(getUserErrorMessage(error, 'error.generic', locale), translate(locale, key));
  }
});

test('intentional cancellation and account changes remain quiet', () => {
  for (const error of [{ code: 'SESSION_CHANGED' }, { name: 'AbortError' }, { code: 'REQUEST_CANCELLED' }]) {
    assert.equal(isSilentError(error), true);
    assert.equal(getUserErrorMessage(error), '');
  }
});

test('the shared error-toast boundary also rejects raw text from future callers', () => {
  const store = useToastStore.getState();
  store.clearToasts();
  store.addToast({ type: 'error', message: 'TypeError getPixelForValue', duration: 0 });
  assert.equal(useToastStore.getState().toasts[0].message, translate('vi', 'error.generic'));
  store.clearToasts();
  assert.equal(store.addToast({ type: 'error', message: '', duration: 0 }), null);
  assert.equal(useToastStore.getState().toasts.length, 0);
});
