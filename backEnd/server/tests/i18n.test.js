'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeLocale, translateMessage, formatBaseCurrency } = require('../utils/i18n');

test('API locale normalization supports vi, en and zh-CN', () => {
    assert.equal(normalizeLocale('vi-VN,vi;q=0.9'), 'vi');
    assert.equal(normalizeLocale('en-US,en;q=0.9'), 'en');
    assert.equal(normalizeLocale('zh-CN,zh;q=0.9'), 'zh-CN');
    assert.equal(normalizeLocale('fr-FR'), 'vi');
});

test('API messages localize without modifying source financial values', () => {
    assert.equal(translateMessage('en', 'Không tìm thấy ví.', false), 'Wallet not found.');
    assert.equal(translateMessage('zh-CN', 'Ngày không hợp lệ.', false), '日期无效。');
    assert.equal(translateMessage('vi', 'Không tìm thấy ví.', false), 'Không tìm thấy ví.');
    assert.match(formatBaseCurrency('en', 27000), /27,000/);
    assert.match(formatBaseCurrency('vi', 27000), /27\.000/);
});

test('validation and wallet messages retain their details in every locale', () => {
    assert.equal(translateMessage('en', 'Số tiền nạp phải là số nguyên lớn hơn 0.'),
        'The deposit must be a whole number greater than zero.');
    assert.equal(translateMessage('zh-CN', 'Số tiền rút phải là số nguyên lớn hơn 0.'),
        '取出金额必须是大于零的整数。');
    assert.match(translateMessage('en', 'Hạn mức cho danh mục "Food" không được là số âm.'), /Food.*cannot be negative/);
    assert.match(translateMessage('zh-CN', 'Hạn mức cho danh mục "餐饮" vượt quá giới hạn tối đa cho phép (100 tỷ VNĐ).'), /餐饮.*1000 亿 VND/);
    assert.match(translateMessage('en', 'Ví đang liên kết với 2 khoản trả góp định kỳ. Vui lòng chọn ví thanh toán thay thế.'), /2 recurring items/);
    assert.equal(translateMessage('en', 'Đã đóng và lưu trữ ví "Cash" thành công!', true), 'Wallet “Cash” archived.');
});

test('literal API messages have specific translations, not generic fallbacks', () => {
    const roots = ['routes', 'middleware', 'utils'];
    const files = roots.flatMap((dir) => fs.readdirSync(path.join(__dirname, '..', dir))
        .filter((name) => name.endsWith('.js') && name !== 'i18n.js')
        .map((name) => path.join(__dirname, '..', dir, name)));
    files.push(path.join(__dirname, '..', 'server.js'));
    const missing = [];
    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/message:\s*(['"])([^\n]*?)\1/g)) {
            const value = match[2];
            if (!/[À-ỹ]/.test(value)) continue;
            const english = translateMessage('en', value);
            const chinese = translateMessage('zh-CN', value);
            if (english === 'Unable to complete the request.' || english === 'Request completed.'
                || chinese === '无法完成请求。' || chinese === '操作已完成。') {
                missing.push(`${path.basename(file)}: ${value}`);
            }
        }
    }
    assert.deepEqual(missing, []);
});

test('technical API failures become plain-language feedback even for Vietnamese', () => {
    for (const locale of ['vi', 'en', 'zh-CN']) {
        for (const source of ['Cần Idempotency-Key dạng UUID cho thao tác ghi.',
            'Idempotency-Key đã dùng với nội dung khác.',
            'Yêu cầu bị từ chối bởi chính sách bảo mật CORS.',
            'ID ví không hợp lệ.', 'API không tồn tại.',
            'Giao dịch chưa được xác nhận. Hãy thử lại với cùng mã yêu cầu.',
            'Tên/email không hợp lệ. Mật khẩu cần ít nhất 12 ký tự và tối đa 72 byte.']) {
            const message = translateMessage(locale, source);
            assert.notEqual(message, source);
            assert.doesNotMatch(message, /Idempotency|UUID|CORS|\bID\b|\bAPI\b|byte|request key|密钥|字节/);
        }
    }
});

test('public response localization changes only copy and preserves error codes and values', () => {
    const { localizeApiResponse } = require('../utils/i18n');
    for (const locale of ['vi', 'en', 'zh-CN']) {
        let result;
        const response = { json: (body) => { result = body; } };
        localizeApiResponse({ get: () => locale }, response, () => {});
        response.json({ success: false, code: 'TRANSACTION_FAILED', amount: 27000,
            message: 'Giao dịch chưa được xác nhận. Hãy thử lại với cùng mã yêu cầu.' });
        assert.equal(result.code, 'TRANSACTION_FAILED');
        assert.equal(result.amount, 27000);
        assert.equal(result.success, false);
        assert.doesNotMatch(result.message, /mã yêu cầu|request key|密钥/);
    }
});

test('financial rejection messages have reviewed translations too', () => {
    const source = fs.readFileSync(path.join(__dirname, '../utils/financialRequest.js'), 'utf8');
    for (const match of source.matchAll(/reject\('([^']+)'/g)) {
        for (const locale of ['en', 'zh-CN']) {
            const result = translateMessage(locale, match[1]);
            assert.notEqual(result, 'Unable to complete the request.', match[1]);
            assert.notEqual(result, '无法完成请求。', match[1]);
            assert.notEqual(result, match[1]);
        }
    }
});
