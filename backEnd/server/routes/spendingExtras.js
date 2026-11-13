'use strict';
// Các phần mở rộng của sổ chi tiêu: chia hóa đơn, ảnh đính kèm, bộ lọc đã lưu,
// tùy chọn ngân sách nâng cao và khôi phục từ file sao lưu. Được gắn vào /api/spending
// trước router chính; đường dẫn nào không khớp ở đây sẽ đi tiếp sang router đó.
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { financialRequest } = require('../utils/financialRequest');
const { isValidVNDAmount } = require('../utils/money');
const { isValidDateString } = require('../utils/localDate');
const { cleanTags, cleanNote } = require('../utils/transactionExtras');
const { helpers: { isValidObjectId, parseTransactionDate, validateTransactionPayload } } = require('./spending');
const Transaction = require('../models/Transaction');
const TransactionRevision = require('../models/TransactionRevision');
const TransactionAttachment = require('../models/TransactionAttachment');
const FinanceSetting = require('../models/FinanceSetting');
const Budget = require('../models/Budget');
const Wallet = require('../models/Wallet');
const WalletActivity = require('../models/WalletActivity');
const Category = require('../models/Category');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');
const ExpectedHighSpendDay = require('../models/ExpectedHighSpendDay');
const Debt = require('../models/Debt');
const User = require('../models/User');

const fail = (res, event, message) => {
    console.error('[finance] ' + event);
    return res.status(500).json({ success: false, message });
};
const transient = error => error?.hasErrorLabel?.('TransientTransactionError');

// =============================================
// POST /api/spending/split – Chia một hóa đơn thành nhiều danh mục
// Mỗi phần là một giao dịch đầy đủ dùng chung splitGroupId; tất cả được ghi hoặc không gì cả.
// =============================================
router.post('/split', protect, financialRequest(async (req, res) => {
    try {
        const { type = 'expense', walletId, date, desc, parts } = req.body || {};
        if (!['income', 'expense'].includes(type) || !isValidObjectId(walletId) ||
            !Array.isArray(parts) || parts.length < 2 || parts.length > 10) {
            return res.status(400).json({ success: false, message: 'Hóa đơn chia nhỏ cần từ 2 đến 10 phần và một ví.' });
        }
        const tags = cleanTags(req.body.tags), note = cleanNote(req.body.note);
        if (tags === null || note === null) {
            return res.status(400).json({ success: false, message: 'Nhãn hoặc ghi chú không hợp lệ.' });
        }
        let total = 0;
        for (const part of parts) {
            const invalid = !part || typeof part !== 'object' || Array.isArray(part)
                ? 'Dữ liệu không hợp lệ.'
                : validateTransactionPayload({ type, amount: part.amount, category: part.category, date });
            if (invalid) return res.status(400).json({ success: false, message: invalid });
            if (part.category.trim().length > 50) {
                return res.status(400).json({ success: false, message: 'Danh mục không hợp lệ.' });
            }
            total += part.amount;
        }
        if (!isValidVNDAmount(total)) {
            return res.status(400).json({ success: false, message: 'Số tiền phải là số nguyên VNĐ trong miền chính xác.' });
        }
        const splitGroupId = new mongoose.Types.ObjectId();
        const title = typeof desc === 'string' ? desc.trim().slice(0, 200) : '';
        const created = await Transaction.create(parts.map(part => ({
            userId: req.user.id, type, walletId, splitGroupId, fee: 0, tags, note, desc: title,
            amount: part.amount, category: part.category.trim(), date: parseTransactionDate(date)
        })), { ordered: true });
        for (const category of new Set(created.map(item => item.category))) {
            await Category.ensureCategorySafe(req.user.id, category);
        }
        return res.status(201).json({ success: true, message: 'Đã lưu hóa đơn chia nhỏ!',
            data: created.map(item => item.toJSON()) });
    } catch (error) {
        if (transient(error)) throw error;
        return fail(res, 'split_failed', 'Lỗi khi tạo giao dịch.');
    }
}));

// =============================================
// Ảnh hóa đơn đính kèm giao dịch
// =============================================
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 600 * 1024;
const MAX_ACCOUNT_ATTACHMENTS = 500;
function decodeImage(dataUrl) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_ATTACHMENT_BYTES * 1.4) return null;
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) return null;
    const data = Buffer.from(match[2], 'base64');
    if (data.length < 12 || data.length > MAX_ATTACHMENT_BYTES) return null;
    // The declared type must match the file signature; never trust the label alone.
    const signature = {
        'image/jpeg': data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
        'image/png': data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        'image/webp': data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP'
    }[match[1]];
    return signature ? { mime: match[1], data } : null;
}
const attachmentSummary = item => ({
    id: item._id.toString(), mime: item.mime, size: item.size, createdAt: item.createdAt
});
async function ownedTransaction(req, res) {
    if (!isValidObjectId(req.params.id)) {
        res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
        return false;
    }
    if (!await Transaction.exists({ _id: req.params.id, userId: req.user.id })) {
        res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
        return false;
    }
    return true;
}

router.get('/:id/attachments', protect, async (req, res) => {
    try {
        if (!await ownedTransaction(req, res)) return undefined;
        const items = await TransactionAttachment.find({ userId: req.user.id, transactionId: req.params.id })
            .select('mime size createdAt').sort({ createdAt: 1 }).lean();
        return res.json({ success: true, data: items.map(attachmentSummary) });
    } catch { return fail(res, 'attachment_list_failed', 'Không thể tải ảnh đính kèm.'); }
});

router.get('/:id/attachments/:attachmentId', protect, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.attachmentId)) {
            return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
        }
        const item = await TransactionAttachment.findOne({
            _id: req.params.attachmentId, transactionId: req.params.id, userId: req.user.id
        }).lean();
        if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh đính kèm.' });
        // Returned as JSON so the image follows the same session, CSRF and no-store rules as other data.
        const bytes = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data.buffer);
        return res.json({ success: true, data: { ...attachmentSummary(item),
            dataUrl: 'data:' + item.mime + ';base64,' + bytes.toString('base64') } });
    } catch { return fail(res, 'attachment_read_failed', 'Không thể tải ảnh đính kèm.'); }
});

router.post('/:id/attachments', protect, async (req, res) => {
    try {
        if (!await ownedTransaction(req, res)) return undefined;
        const image = decodeImage(req.body?.dataUrl);
        if (!image) {
            return res.status(400).json({ success: false, message: 'Ảnh không hợp lệ. Chỉ nhận JPEG, PNG hoặc WebP tối đa 600KB.' });
        }
        const [forTransaction, forAccount] = await Promise.all([
            TransactionAttachment.countDocuments({ userId: req.user.id, transactionId: req.params.id }),
            TransactionAttachment.countDocuments({ userId: req.user.id })
        ]);
        if (forTransaction >= MAX_ATTACHMENTS) {
            return res.status(400).json({ success: false, message: 'Mỗi giao dịch chỉ đính kèm tối đa 3 ảnh.' });
        }
        if (forAccount >= MAX_ACCOUNT_ATTACHMENTS) {
            return res.status(400).json({ success: false, message: 'Tài khoản đã đạt giới hạn ảnh đính kèm. Hãy xóa bớt ảnh cũ.' });
        }
        const created = await TransactionAttachment.create({ userId: req.user.id, transactionId: req.params.id,
            mime: image.mime, size: image.data.length, data: image.data });
        return res.status(201).json({ success: true, message: 'Đã đính kèm ảnh.', data: attachmentSummary(created) });
    } catch { return fail(res, 'attachment_write_failed', 'Không thể lưu ảnh đính kèm.'); }
});

router.delete('/:id/attachments/:attachmentId', protect, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.attachmentId)) {
            return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
        }
        const result = await TransactionAttachment.deleteOne({
            _id: req.params.attachmentId, transactionId: req.params.id, userId: req.user.id
        });
        if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh đính kèm.' });
        return res.json({ success: true, message: 'Đã xóa ảnh đính kèm.' });
    } catch { return fail(res, 'attachment_delete_failed', 'Không thể xóa ảnh đính kèm.'); }
});

// =============================================
// Bộ lọc đã lưu và tùy chọn ngân sách nâng cao
// =============================================
const DATE_PRESETS = ['all', 'thisMonth', 'lastMonth', 'last7Days', 'custom'];
const FILTER_TYPES = ['all', 'income', 'expense', 'transfer', 'wallet_created'];
function cleanCriteria(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const text = (value, max, fallback) => typeof value === 'string' && value.length <= max ? value.trim() || fallback : null;
    const amount = value => value === null || value === undefined || value === ''
        ? null : (isValidVNDAmount(value, { allowZero: true }) ? value : undefined);
    const date = value => value === '' || value === undefined || value === null ? '' : (isValidDateString(value) ? value : null);
    const criteria = {
        query: text(input.query ?? '', 100, ''),
        type: FILTER_TYPES.includes(input.type ?? 'all') ? input.type ?? 'all' : null,
        category: text(input.category ?? 'all', 50, 'all'),
        walletId: input.walletId === undefined || input.walletId === 'all' ? 'all'
            : (isValidObjectId(input.walletId) ? String(input.walletId) : null),
        tag: text(input.tag ?? 'all', 30, 'all'),
        minAmount: amount(input.minAmount), maxAmount: amount(input.maxAmount),
        datePreset: DATE_PRESETS.includes(input.datePreset ?? 'all') ? input.datePreset ?? 'all' : null,
        startDate: date(input.startDate), endDate: date(input.endDate),
        excludeRecurring: input.excludeRecurring === true
    };
    // null is a valid "no bound" for the amounts, so they signal a bad value with undefined instead.
    const invalid = ['query', 'type', 'category', 'walletId', 'tag', 'datePreset', 'startDate', 'endDate']
        .some(key => criteria[key] === null) || criteria.minAmount === undefined || criteria.maxAmount === undefined;
    return invalid ? null : criteria;
}
const publicSettings = setting => ({
    savedFilters: (setting?.savedFilters || []).map(filter => ({
        id: filter._id.toString(), name: filter.name, criteria: filter.criteria
    })),
    budget: {
        totalLimit: setting?.budget?.totalLimit || 0,
        weeklyLimit: setting?.budget?.weeklyLimit || 0,
        rollover: setting?.budget?.rollover === true
    }
});

router.get('/settings', protect, async (req, res) => {
    try {
        const setting = await FinanceSetting.findOne({ userId: req.user.id }).lean();
        return res.json({ success: true, data: publicSettings(setting) });
    } catch { return fail(res, 'settings_read_failed', 'Không thể tải tùy chọn.'); }
});

router.put('/saved-filters', protect, async (req, res) => {
    try {
        const filters = req.body?.filters;
        if (!Array.isArray(filters) || filters.length > 12) {
            return res.status(400).json({ success: false, message: 'Chỉ lưu được tối đa 12 bộ lọc.' });
        }
        const clean = [];
        for (const filter of filters) {
            const name = typeof filter?.name === 'string' ? filter.name.trim() : '';
            const criteria = cleanCriteria(filter?.criteria);
            if (!name || name.length > 40 || !criteria) {
                return res.status(400).json({ success: false, message: 'Bộ lọc không hợp lệ.' });
            }
            clean.push({ name, criteria });
        }
        const setting = await FinanceSetting.findOneAndUpdate({ userId: req.user.id },
            { $set: { savedFilters: clean } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
        return res.json({ success: true, message: 'Đã lưu bộ lọc.', data: publicSettings(setting) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        return fail(res, 'saved_filters_failed', 'Không thể lưu bộ lọc.');
    }
});

router.put('/budget-settings', protect, async (req, res) => {
    try {
        const { totalLimit = 0, weeklyLimit = 0, rollover = false } = req.body || {};
        const validLimit = value => isValidVNDAmount(value, { allowZero: true }) && value <= 100000000000;
        if (!validLimit(totalLimit) || !validLimit(weeklyLimit) || typeof rollover !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Tùy chọn ngân sách không hợp lệ.' });
        }
        const setting = await FinanceSetting.findOneAndUpdate({ userId: req.user.id },
            { $set: { budget: { totalLimit, weeklyLimit, rollover } } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
        return res.json({ success: true, message: 'Đã lưu tùy chọn ngân sách.', data: publicSettings(setting) });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ success: false, message: 'Không thể hoàn thành yêu cầu. Vui lòng thử lại.' });
        return fail(res, 'budget_settings_failed', 'Không thể lưu tùy chọn ngân sách.');
    }
});

// =============================================
// POST /api/spending/restore-backup – Khôi phục từ file "Xuất JSON"
// Thay toàn bộ dữ liệu tài chính của tài khoản bằng nội dung file. Chạy trong một transaction:
// file sai ở bất kỳ đâu, hoặc tạo ra số dư không hợp lệ, thì dữ liệu hiện tại được giữ nguyên.
// =============================================
const RESTORE_LIMITS = { transactions: 20000, budgets: 5000, wallets: 200, categories: 500, jars: 200,
    installments: 500, expectedHighSpendDays: 5000, transactionRevisions: 20000, walletHistory: 1000, debts: 1000 };
const INVALID_BACKUP = 'File sao lưu không hợp lệ hoặc không phải do CaltDHy xuất ra.';
const idOf = value => {
    const id = value && typeof value === 'object' && value._id !== undefined ? value._id : value;
    return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id) ? id.toLowerCase() : null;
};
router.post('/restore-backup', protect, financialRequest(async (req, res) => {
    const invalid = () => res.status(400).json({ success: false, message: INVALID_BACKUP });
    try {
        const backup = req.body?.backup;
        if (req.body?.confirm !== 'RESTORE') {
            return res.status(400).json({ success: false, message: 'Cần xác nhận trước khi khôi phục dữ liệu.' });
        }
        if (!backup || typeof backup !== 'object' || Array.isArray(backup) || backup.version !== 1) return invalid();
        const lists = {};
        for (const [key, limit] of Object.entries(RESTORE_LIMITS)) {
            const list = backup[key] === undefined ? [] : backup[key];
            if (!Array.isArray(list) || list.length > limit ||
                list.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return invalid();
            lists[key] = list;
        }
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const session = mongoose.transactionAsyncLocalStorage?.getStore()?.session;
        const options = session ? { session } : {};

        // Mọi bản ghi nhận ID mới: file có thể đến từ tài khoản khác, và ID cũ có thể đã tồn tại.
        const maps = { wallet: new Map(), jar: new Map(), installment: new Map(), transaction: new Map(), group: new Map() };
        const fresh = (map, value, create = false) => {
            const id = idOf(value);
            if (!id) return null;
            if (!map.has(id) && create) map.set(id, new mongoose.Types.ObjectId());
            return map.get(id) || null;
        };
        const base = (item, _id) => {
            const { __v, id, ...rest } = item;
            return { ...rest, _id, userId };
        };
        for (const [key, map] of [['wallets', maps.wallet], ['jars', maps.jar], ['installments', maps.installment], ['transactions', maps.transaction]]) {
            for (const item of lists[key]) if (!fresh(map, item, true)) return invalid();
        }
        const link = (map, value) => {
            if (value === null || value === undefined || value === '') return null;
            return fresh(map, value) || undefined; // undefined = points at something missing from the file
        };

        const wallets = lists.wallets.map(item => base(item, fresh(maps.wallet, item)));
        const jars = lists.jars.map(item => base(item, fresh(maps.jar, item)));
        const installments = [];
        for (const item of lists.installments) {
            const walletId = link(maps.wallet, item.walletId);
            // Ví thanh toán đã bị xóa khỏi file: giữ khoản định kỳ, bỏ liên kết ví.
            installments.push({ ...base(item, fresh(maps.installment, item)), walletId: walletId || null });
        }
        const transactions = [];
        for (const item of lists.transactions) {
            const date = typeof item.date === 'string' ? parseTransactionDate(item.date.slice(0, 10)) : null;
            const refs = { walletId: link(maps.wallet, item.walletId), toWalletId: link(maps.wallet, item.toWalletId),
                jarId: link(maps.jar, item.jarId), installmentId: link(maps.installment, item.installmentId) };
            // A ledger entry pointing at a wallet that is not in the file cannot be balanced.
            if (!date || refs.walletId === undefined || refs.toWalletId === undefined) return invalid();
            transactions.push({ ...base(item, fresh(maps.transaction, item)), date,
                walletId: refs.walletId, toWalletId: refs.toWalletId,
                jarId: refs.jarId || null, installmentId: refs.installmentId || null,
                tags: cleanTags(item.tags) || [], note: cleanNote(item.note) || '',
                splitGroupId: idOf(item.splitGroupId) ? fresh(maps.group, item.splitGroupId, true) : null });
        }
        const snapshot = value => {
            if (!value || typeof value !== 'object') return value ?? null;
            const mapped = (map, id, create) => (idOf(id) ? String(fresh(map, id, create) || id) : id ?? null);
            return { ...value, id: mapped(maps.transaction, value.id, true),
                walletId: mapped(maps.wallet, value.walletId), toWalletId: mapped(maps.wallet, value.toWalletId),
                jarId: mapped(maps.jar, value.jarId), installmentId: mapped(maps.installment, value.installmentId),
                splitGroupId: mapped(maps.group, value.splitGroupId, true) };
        };
        const revisions = [];
        for (const item of lists.transactionRevisions) {
            // Lịch sử của giao dịch đã xóa vẫn được giữ, gắn với một ID mới ổn định.
            const transactionId = fresh(maps.transaction, item.transactionId, true);
            if (!transactionId) return invalid();
            revisions.push({ ...base(item, new mongoose.Types.ObjectId()), transactionId, actorId: userId,
                before: snapshot(item.before), after: snapshot(item.after) });
        }
        const activities = lists.walletHistory.map(item => ({ ...base(item, new mongoose.Types.ObjectId()),
            walletId: link(maps.wallet, item.walletId) })).filter(item => item.walletId);
        const plain = key => lists[key].map(item => base(item, new mongoose.Types.ObjectId()));
        const customCategories = Array.isArray(backup.customCategories)
            ? backup.customCategories.filter(name => typeof name === 'string' && name.trim() && name.length <= 50)
                .slice(0, 100).map(name => name.trim()) : [];
        const categoryNames = new Set(lists.categories.map(item => item.name)
            .filter(name => typeof name === 'string' && name.trim() && name.length <= 50).map(name => name.trim()));
        const savedFilters = (Array.isArray(backup.savedFilters) ? backup.savedFilters : []).slice(0, 12).map(filter => {
            const criteria = cleanCriteria({ ...filter?.criteria, walletId:
                String(link(maps.wallet, filter?.criteria?.walletId) || 'all') });
            const name = typeof filter?.name === 'string' ? filter.name.trim().slice(0, 40) : '';
            return name && criteria ? { name, criteria } : null;
        }).filter(Boolean);
        const budgetInput = backup.budgetSettings && typeof backup.budgetSettings === 'object' ? backup.budgetSettings : {};
        const limit = value => (isValidVNDAmount(value, { allowZero: true }) && value <= 100000000000 ? value : 0);

        for (const Model of [Transaction, TransactionRevision, TransactionAttachment, WalletActivity, Budget,
            ExpectedHighSpendDay, Wallet, Jar, Installment, Category, Debt]) {
            await Model.deleteMany({ userId }, options);
        }
        const inserts = [[Wallet, wallets], [Jar, jars], [Installment, installments], [Transaction, transactions],
            [TransactionRevision, revisions], [WalletActivity, activities], [Budget, plain('budgets')],
            [ExpectedHighSpendDay, plain('expectedHighSpendDays')], [Debt, plain('debts')]];
        for (const [Model, documents] of inserts) {
            if (documents.length) await Model.insertMany(documents, { ...options, ordered: true });
        }
        for (const name of categoryNames) await Category.ensureCategorySafe(req.user.id, name);
        await User.updateOne({ _id: userId }, { $set: { customCategories } }, options);
        await FinanceSetting.findOneAndUpdate({ userId }, { $set: { savedFilters, budget: {
            totalLimit: limit(budgetInput.totalLimit), weeklyLimit: limit(budgetInput.weeklyLimit),
            rollover: budgetInput.rollover === true } } }, { ...options, upsert: true, runValidators: true });

        return res.json({ success: true, message: 'Đã khôi phục dữ liệu từ file sao lưu.', data: {
            wallets: wallets.length, transactions: transactions.length, jars: jars.length,
            installments: installments.length, budgets: lists.budgets.length, debts: lists.debts.length } });
    } catch (error) {
        if (transient(error)) throw error;
        // Schema validation, cast and duplicate-key failures all mean the file is not a usable backup.
        if (['ValidationError', 'CastError', 'MongoBulkWriteError', 'StrictModeError'].includes(error?.name) || error?.code === 11000) {
            return invalid();
        }
        return fail(res, 'restore_backup_failed', 'Không thể khôi phục dữ liệu. Dữ liệu hiện tại được giữ nguyên.');
    }
}));

module.exports = router;
