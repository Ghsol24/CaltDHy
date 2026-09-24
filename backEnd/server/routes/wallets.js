const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { financialRequest } = require('../utils/financialRequest');
const { protect } = require('../middleware/authMiddleware');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Installment = require('../models/Installment');
const { runWithTransaction } = require('../utils/mongoTransaction');
const { getWalletBalance, getAllWalletBalances } = require('../utils/walletBalance');
const { isValidVNDAmount, isFiniteInteger } = require('../utils/money');
const { normalizeLocale, formatBaseCurrency } = require('../utils/i18n');

// Tất cả routes wallets đều cần xác thực JWT
router.use(protect);

const isValidObjectId = (id) => (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) || id instanceof mongoose.Types.ObjectId;

/**
 * Helper: Tự động khởi tạo ví mặc định "Tiền mặt" nếu user chưa có ví nào
 */
async function ensureDefaultWallet(userId) {
    let count = await Wallet.countDocuments({ userId, archived: false });
    if (count === 0) {
        const defaultWallet = await Wallet.create({
            userId,
            name: 'Tiền mặt',
            type: 'cash',
            icon: '💵',
            color: '#2ed573',
            initialBalance: 0,
            isDefault: true,
            isExcludedFromTotal: false
        });
        return [defaultWallet];
    }
    return null;
}

// =============================================
// GET /api/wallets — Lấy danh sách ví của user
// Hỗ trợ query ?includeArchived=true để lấy cả các ví đã đóng / lưu trữ
// =============================================
router.get('/', financialRequest(async (req, res) => {
    try {
        await ensureDefaultWallet(req.user.id);
        const includeArchived = req.query?.includeArchived === 'true';
        const query = { userId: req.user.id };
        if (!includeArchived) {
            query.archived = false;
        }
        const wallets = await Wallet.find(query).sort({ isDefault: -1, createdAt: 1 });
        res.json({
            success: true,
            data: wallets.map(w => w.toJSON())
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách ví.' });
    }
}));

// =============================================
// GET /api/wallets/:id/pre-archive — Kiểm tra nhanh trạng thái ví trước khi đóng/lưu trữ
// =============================================
router.get('/:id/pre-archive', financialRequest(async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const wallet = await Wallet.findOne({ _id: id, userId: req.user.id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });
        }

        const balance = await getWalletBalance(req.user.id, id);

        const activeInstallments = await Installment.find({
            userId: req.user.id,
            walletId: id,
            $or: [{ active: true }, { isActive: true }]
        }).select('name amount monthlyAmount totalAmount cycle nextDueDate dueDate');

        const transactionsCount = await Transaction.countDocuments({
            userId: req.user.id,
            $or: [{ walletId: id }, { toWalletId: id }]
        });

        const activeWalletsCount = await Wallet.countDocuments({ userId: req.user.id, archived: false });

        res.json({
            success: true,
            data: {
                wallet: wallet.toJSON(),
                balance,
                activeInstallments: activeInstallments.map(i => ({
                    id: i._id.toString(),
                    name: i.name,
                    amount: i.monthlyAmount || i.amount,
                    cycle: i.cycle,
                    nextDueDate: i.nextDueDate || i.dueDate
                })),
                transactionsCount,
                activeWalletsCount,
                isDefault: Boolean(wallet.isDefault),
                canArchiveDirectly: balance === 0 && activeInstallments.length === 0 && !wallet.isDefault && activeWalletsCount > 1
            }
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra thông tin ví.' });
    }
}));

// =============================================
// POST /api/wallets/:id/archive — Đóng và lưu trữ ví (Soft-delete theo chuẩn FinTech)
// =============================================
router.post('/:id/archive', financialRequest(async (req, res) => {
    try {
        const { id } = req.params;
        const { transferToWalletId, replacementWalletId } = req.body || {};

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const wallet = await Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví hoặc ví đã được lưu trữ trước đó.' });
        }

        if (wallet.isDefault) {
            return res.status(400).json({
                success: false,
                code: 'CANNOT_ARCHIVE_DEFAULT_WALLET',
                message: 'Không thể đóng ví mặc định. Vui lòng chọn một ví khác làm mặc định trước.'
            });
        }

        const activeWalletsCount = await Wallet.countDocuments({ userId: req.user.id, archived: false });
        if (activeWalletsCount <= 1) {
            return res.status(400).json({
                success: false,
                code: 'LAST_ACTIVE_WALLET',
                message: 'Bạn không thể đóng ví hoạt động duy nhất còn lại.'
            });
        }

        const currentBalance = await getWalletBalance(req.user.id, id);

        // 1. Kiểm tra dư nợ âm (thẻ tín dụng hoặc thấu chi)
        if (currentBalance < 0) {
            return res.status(400).json({
                success: false,
                code: 'SETTLE_DEBT_FIRST',
                message: `Ví hiện đang có dư nợ (${formatBaseCurrency(normalizeLocale(req.get('Accept-Language')), Math.abs(currentBalance))}). Vui lòng thanh toán hết dư nợ trước khi đóng ví.`,
                balance: currentBalance
            });
        }

        // 2. Kiểm tra số dư dương
        if (currentBalance > 0) {
            if (!transferToWalletId) {
                return res.status(400).json({
                    success: false,
                    code: 'WALLET_BALANCE_NOT_ZERO',
                    message: `Ví vẫn còn số dư (${formatBaseCurrency(normalizeLocale(req.get('Accept-Language')), currentBalance)}). Vui lòng chọn ví nhận số dư trước khi đóng ví.`,
                    balance: currentBalance
                });
            }
            if (transferToWalletId.toString() === id.toString()) {
                return res.status(400).json({ success: false, message: 'Ví nhận số dư phải khác ví đang đóng.' });
            }
            const targetWallet = await Wallet.findOne({ _id: transferToWalletId, userId: req.user.id, archived: false });
            if (!targetWallet) {
                return res.status(400).json({ success: false, message: 'Ví nhận số dư không tồn tại hoặc đã bị lưu trữ.' });
            }
        }

        // 3. Kiểm tra các khoản chi trả góp / định kỳ
        const activeInstallments = await Installment.find({
            userId: req.user.id,
            walletId: id,
            $or: [{ active: true }, { isActive: true }]
        });

        if (activeInstallments.length > 0) {
            if (!replacementWalletId) {
                return res.status(400).json({
                    success: false,
                    code: 'HAS_ACTIVE_INSTALLMENTS',
                    message: `Ví đang liên kết với ${activeInstallments.length} khoản trả góp định kỳ. Vui lòng chọn ví thanh toán thay thế.`,
                    installments: activeInstallments.map(i => i.name)
                });
            }
            if (replacementWalletId.toString() === id.toString()) {
                return res.status(400).json({ success: false, message: 'Ví thay thế cho các khoản định kỳ phải khác ví đang đóng.' });
            }
            const repWallet = await Wallet.findOne({ _id: replacementWalletId, userId: req.user.id, archived: false });
            if (!repWallet) {
                return res.status(400).json({ success: false, message: 'Ví thay thế cho các khoản định kỳ không tồn tại hoặc đã bị lưu trữ.' });
            }
        }

        // 4. Thực thi transaction an toàn
        await runWithTransaction(async (session) => {
            const opts = session ? { session } : {};

            // A. Tự động tạo giao dịch transfer chuyển sạch số dư sang ví đích nếu có
            if (currentBalance > 0 && transferToWalletId) {
                await Transaction.create([
                    {
                        userId: req.user.id,
                        type: 'transfer',
                        amount: currentBalance,
                        date: new Date().toISOString().slice(0, 10),
                        walletId: id,
                        toWalletId: transferToWalletId,
                        category: 'Chuyển tiền',
                        desc: `Tất toán số dư đóng ví "${wallet.name}"`,
                        systemGenerated: true,
                        fee: 0
                    }
                ], opts);
            }

            // B. Cập nhật các khoản trả góp sang ví thay thế
            if (activeInstallments.length > 0 && replacementWalletId) {
                await Installment.updateMany(
                    { userId: req.user.id, walletId: id },
                    { $set: { walletId: replacementWalletId } },
                    opts
                );
            }

            // C. Cập nhật trạng thái lưu trữ
            wallet.archived = true;
            wallet.archivedAt = new Date();
            wallet.isDefault = false;
            await wallet.save(opts);
        });

        res.json({
            success: true,
            message: `Đã đóng và lưu trữ ví "${wallet.name}" thành công!`,
            data: wallet.toJSON()
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi đóng ví.' });
    }
}));

// =============================================
// POST /api/wallets/:id/unarchive — Mở lại ví đã lưu trữ
// =============================================
router.post('/:id/unarchive', financialRequest(async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const wallet = await Wallet.findOne({ _id: id, userId: req.user.id, archived: true });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví đã lưu trữ.' });
        }

        wallet.archived = false;
        wallet.archivedAt = null;
        await wallet.save();

        res.json({
            success: true,
            message: `Đã mở lại ví "${wallet.name}".`,
            data: wallet.toJSON()
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi mở lại ví.' });
    }
}));

// =============================================
// GET /api/wallets/balances — Lấy số dư thực tế tính on-the-fly của các ví
// Hỗ trợ query ?walletId=<id> để lấy 1 ví hoặc không truyền để lấy tất cả
// =============================================
router.get('/balances', financialRequest(async (req, res) => {
    try {
        const { walletId } = req.query;
        if (walletId) {
            if (!isValidObjectId(walletId)) {
                return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
            }
            const balance = await getWalletBalance(req.user.id, walletId);
            return res.json({
                success: true,
                data: {
                    [walletId]: balance
                }
            });
        }

        const balances = await getAllWalletBalances(req.user.id);
        res.json({
            success: true,
            data: balances
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi tính số dư ví.' });
    }
}));

// =============================================
// POST /api/wallets — Tạo ví mới
// =============================================
router.post('/', financialRequest(async (req, res) => {
    try {
        const { name, type, icon, color, initialBalance, creditLimit, isExcludedFromTotal, isDefault } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Tên ví không được để trống.' });
        }

        const validTypes = ['cash', 'bank', 'e-wallet', 'credit', 'savings'];
        const walletType = validTypes.includes(type) ? type : 'cash';

        if (isDefault) {
            await Wallet.updateMany({ userId: req.user.id }, { isDefault: false });
        }

        const newWallet = await Wallet.create({
            userId: req.user.id,
            name: name.trim(),
            type: walletType,
            icon: icon || (walletType === 'bank' ? '🏦' : walletType === 'credit' ? '💳' : walletType === 'e-wallet' ? '📱' : '💵'),
            color: color || '#2ed573',
            initialBalance: isFiniteInteger(initialBalance) ? Number(initialBalance) : 0,
            creditLimit: isValidVNDAmount(creditLimit, { allowZero: true }) ? Number(creditLimit) : 0,
            isExcludedFromTotal: Boolean(isExcludedFromTotal),
            isDefault: Boolean(isDefault)
        });

        res.status(201).json({
            success: true,
            message: 'Tạo ví mới thành công!',
            data: newWallet.toJSON()
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi tạo ví mới.' });
    }
}));

// =============================================
// PUT /api/wallets/:id — Cập nhật ví
// =============================================
router.put('/:id', financialRequest(async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const { name, type, icon, color, initialBalance, creditLimit, isExcludedFromTotal, isDefault } = req.body;

        const wallet = await Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });
        }

        if (name && name.trim()) wallet.name = name.trim();
        if (type && ['cash', 'bank', 'e-wallet', 'credit', 'savings'].includes(type)) wallet.type = type;
        if (icon !== undefined) wallet.icon = icon;
        if (color !== undefined) wallet.color = color;
        if (initialBalance !== undefined && isFiniteInteger(initialBalance)) wallet.initialBalance = Number(initialBalance);
        if (creditLimit !== undefined && isValidVNDAmount(creditLimit, { allowZero: true })) wallet.creditLimit = Number(creditLimit);
        if (isExcludedFromTotal !== undefined) wallet.isExcludedFromTotal = Boolean(isExcludedFromTotal);

        if (isDefault && !wallet.isDefault) {
            await Wallet.updateMany({ userId: req.user.id }, { isDefault: false });
            wallet.isDefault = true;
        }

        await wallet.save();

        res.json({
            success: true,
            message: 'Cập nhật ví thành công!',
            data: wallet.toJSON()
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        console.error('[finance] route_failed');
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật ví.' });
    }
}));

// =============================================
// DELETE /api/wallets/:id — Xóa ví (Bảo toàn initialBalance và chuyển giao dịch về ví mặc định)
// =============================================
router.delete('/:id', financialRequest(async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
        }

        const walletCount = await Wallet.countDocuments({ userId: req.user.id, archived: false });
        if (walletCount <= 1) {
            return res.status(400).json({ success: false, message: 'Bạn không thể xóa ví duy nhất còn lại.' });
        }

        const result = await runWithTransaction(async (session) => {
            // 1. CHECKS
            const queryDel = Wallet.findOne({ _id: id, userId: req.user.id, archived: false });
            if (session) queryDel.session(session);
            const walletToDelete = await queryDel;

            if (!walletToDelete) {
                const err = new Error('WALLET_NOT_FOUND');
                err.status = 404;
                throw err;
            }

            // Tìm ví mặc định hoặc ví thay thế khác để nhận lại các giao dịch & initialBalance
            let queryDef = Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, isDefault: true, archived: false });
            if (session) queryDef.session(session);
            let defaultWallet = await queryDef;

            if (!defaultWallet) {
                let queryAny = Wallet.findOne({ _id: { $ne: id }, userId: req.user.id, archived: false });
                if (session) queryAny.session(session);
                defaultWallet = await queryAny;
                if (defaultWallet) {
                    defaultWallet.isDefault = true;
                }
            }

            if (!defaultWallet) {
                const err = new Error('NO_FALLBACK_WALLET');
                err.status = 400;
                throw err;
            }

            // 2. EFFECTS
            if (walletToDelete.isDefault) {
                walletToDelete.isDefault = false;
                await walletToDelete.save({ session });
            }
            // A. Chuyển toàn bộ giao dịch từ ví bị xóa sang ví mặc định
            const updateOpts = session ? { session } : {};
            await Transaction.updateMany(
                { walletId: id, userId: req.user.id },
                { $set: { walletId: defaultWallet._id } },
                updateOpts
            );
            await Transaction.updateMany(
                { toWalletId: id, userId: req.user.id },
                { $set: { toWalletId: defaultWallet._id } },
                updateOpts
            );

            // Xử lý các giao dịch transfer bị trùng cả ví nguồn và ví đích (chuyển tiền cho chính nó sau khi gộp ví)
            // và cập nhật các khoản định kỳ
            const canRunExtraOps = (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) || (Installment.updateMany !== mongoose.Model.updateMany);
            if (canRunExtraOps) {
                // Nếu có phí (fee > 0): chuyển thành giao dịch expense ghi nhận đúng khoản phí đó
                await Transaction.updateMany(
                    {
                        userId: req.user.id,
                        type: 'transfer',
                        walletId: defaultWallet._id,
                        toWalletId: defaultWallet._id,
                        fee: { $gt: 0 }
                    },
                    [
                        {
                            $set: {
                                type: 'expense',
                                category: 'Khác',
                                amount: '$fee',
                                fee: 0,
                                toWalletId: null,
                                desc: { $concat: ['$desc', ' (Phí chuyển tiền - đã gộp ví)'] }
                            }
                        }
                    ],
                    updateOpts
                );
                // Nếu không có phí: dọn dẹp giao dịch transfer tự thân vô nghĩa này
                await Transaction.deleteMany(
                    {
                        userId: req.user.id,
                        type: 'transfer',
                        walletId: defaultWallet._id,
                        toWalletId: defaultWallet._id
                    },
                    updateOpts
                );

                // Cập nhật các khoản thanh toán định kỳ trỏ về ví mặc định
                await Installment.updateMany(
                    { walletId: id, userId: req.user.id },
                    { $set: { walletId: defaultWallet._id } },
                    updateOpts
                );
            }

            // B. Bảo toàn 100% initialBalance: cộng dồn vào ví mặc định (Zero Data Loss thực sự)
            const transferInitialBalance = Number(walletToDelete.initialBalance) || 0;
            if (transferInitialBalance !== 0) {
                defaultWallet.initialBalance = (Number(defaultWallet.initialBalance) || 0) + transferInitialBalance;
            }
            await defaultWallet.save(session ? { session } : {});

            // C. Xóa ví
            const delQuery = Wallet.findOneAndDelete({ _id: id, userId: req.user.id });
            if (session) delQuery.session(session);
            await delQuery;

            return {
                fallbackWalletId: defaultWallet._id.toString()
            };
        });

        res.json({
            success: true,
            message: 'Đã xóa ví, bảo toàn số dư gốc và chuyển các giao dịch liên quan về ví mặc định!',
            fallbackWalletId: result.fallbackWalletId
        });
    } catch (error) {
        if (error.hasErrorLabel?.('TransientTransactionError')) throw error;
        if (error.message === 'WALLET_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy ví cần xóa.' });
        }
        if (error.message === 'NO_FALLBACK_WALLET') {
            return res.status(400).json({ success: false, message: 'Không tìm thấy ví thay thế hợp lệ.' });
        }
        console.error('[finance] route_failed');
        res.status(error.status || 500).json({ success: false, message: 'Lỗi khi xóa ví.' });
    }
}));

module.exports = router;
