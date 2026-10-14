'use strict';

const supported = new Set(['vi', 'en', 'zh-CN']);

function normalizeLocale(header = '') {
    const first = String(header).split(',')[0].trim().toLowerCase();
    if (first.startsWith('zh')) return 'zh-CN';
    if (first.startsWith('en')) return 'en';
    return 'vi';
}

const { apiMessages } = require('../../../frontEnd-react/src/i18n/apiMessages.mjs');

function translateDynamic(message, locale) {
    const index = locale === 'en' ? 0 : 1;
    let match = message.match(/^Hạn mức cho danh mục "(.+)" (không hợp lệ\.|phải là số nguyên \(VNĐ không có phần thập phân\)\.|không được là số âm\.|vượt quá giới hạn tối đa cho phép \(100 tỷ VNĐ\)\.)$/);
    if (match) {
        const suffix = {
            'không hợp lệ.': ['is invalid.', '无效。'],
            'phải là số nguyên (VNĐ không có phần thập phân).': ['must be a whole VND amount.', '必须是 VND 整数。'],
            'không được là số âm.': ['cannot be negative.', '不能为负数。'],
            'vượt quá giới hạn tối đa cho phép (100 tỷ VNĐ).': ['exceeds the maximum of 100 billion VND.', '超过 1000 亿 VND 的上限。'],
        }[match[2]][index];
        return locale === 'en' ? `The limit for category "${match[1]}" ${suffix}` : `分类“${match[1]}”的限额${suffix}`;
    }
    match = message.match(/^Ví hiện đang có dư nợ \((.+)\)\./);
    if (match) return locale === 'en'
        ? `This wallet has an outstanding balance (${match[1]}). Pay it off before archiving the wallet.`
        : `此钱包仍有欠款（${match[1]}）。归档前请先还清欠款。`;
    match = message.match(/^Ví vẫn còn số dư \((.+)\)\./);
    if (match) return locale === 'en'
        ? `This wallet still has a balance (${match[1]}). Choose a destination wallet before archiving it.`
        : `此钱包仍有余额（${match[1]}）。归档前请选择接收余额的钱包。`;
    match = message.match(/^Ví đang liên kết với (\d+) khoản trả góp định kỳ\. Vui lòng chọn ví thanh toán thay thế\.$/);
    if (match) return locale === 'en'
        ? `This wallet is linked to ${match[1]} recurring items. Choose a replacement payment wallet.`
        : `此钱包关联 ${match[1]} 个周期项目。请选择替代付款钱包。`;
    match = message.match(/^Đã đóng và lưu trữ ví "(.+)" thành công!$/);
    if (match) return locale === 'en' ? `Wallet “${match[1]}” archived.` : `钱包“${match[1]}”已归档。`;
    match = message.match(/^Đã mở lại ví "(.+)"\.$/);
    if (match) return locale === 'en' ? `Wallet “${match[1]}” reopened.` : `钱包“${match[1]}”已重新启用。`;
    return null;
}

function translateMessage(locale, message, success = false) {
    if (!message) return message;
    const entry = apiMessages[message];
    if (entry) return entry[locale === 'en' ? 1 : locale === 'zh-CN' ? 2 : 0];
    if (locale === 'vi') return message;
    if (/[À-ỹ]/.test(message)) return translateDynamic(message, locale)
        || (success
            ? (locale === 'en' ? 'Request completed.' : '操作已完成。')
            : (locale === 'en' ? 'Unable to complete the request.' : '无法完成请求。'));
    return message;
}

function formatBaseCurrency(locale, amount) {
    const intlLocale = locale === 'en' ? 'en-US' : locale === 'zh-CN' ? 'zh-CN' : 'vi-VN';
    return new Intl.NumberFormat(intlLocale, {
        style: 'currency', currency: 'VND', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0
    }).format(amount);
}

function localizeApiResponse(req, res, next) {
    const locale = normalizeLocale(req.get('Accept-Language'));
    if (!supported.has(locale)) return next();
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.message === 'string') {
            body = { ...body, message: translateMessage(locale, body.message, body.success === true) };
        }
        return originalJson(body);
    };
    return next();
}

module.exports = { normalizeLocale, translateMessage, localizeApiResponse, formatBaseCurrency };
