const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Jar = require('../models/Jar');
const Installment = require('../models/Installment');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');
const { runWithTransaction } = require('../utils/mongoTransaction');
const { isValidVNDAmount } = require('../utils/money');
const { getVietnamTodayString, nowAsVietnamDateAnchor } = require('../utils/localDate');

// Tất cả routes Jars đều yêu cầu xác thực
router.use(protect);

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/* =============================================
   JARS (HŨ TIẾT KIỆM)
   ============================================= */

// GET /api/jars — Lấy tất cả hũ của user
router.get('/', async (req, res) => {
    try {
        const jars = await Jar.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, data: jars.map(j => j.toJSON()) });
    } catch (error) {
        console.error('GET /api/jars error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách hũ.' });
    }
});

// POST /api/jars — Tạo hũ mới (3.2: Khởi tạo history giải trình nếu current > 0)
router.post('/', async (req, res) => {
    try {
        const { name, category, icon, target, current, targetDate, color } = req.body;

        if (!name || !target) {
            return res.status(400).json({ success: false, message: 'Tên và mục tiêu không được để trống.' });
        }
        if (!isValidVNDAmount(target)) {
            return res.status(400).json({ success: false, message: 'Mục tiêu phải là số nguyên lớn hơn 0 (VNĐ không có phần thập phân).' });
        }

        const initialAmount = isValidVNDAmount(current, { allowZero: true }) ? Number(current) : 0;
        const initialHistory = initialAmount > 0 ? [{
            type: 'deposit',
            amount: initialAmount,
            reason: 'Số dư ban đầu khi tạo hũ',
            date: new Date()
        }] : [];

        const jar = await Jar.create({
            userId: req.user.id,
            name: name.trim(),
            category: (category || 'Mục tiêu chung').trim(),
            icon: icon || '🫙',
            target: Number(target),
            current: initialAmount,
            targetDate: targetDate || null,
            color: color || '#5356F1',
            history: initialHistory
        });

        res.status(201).json({ success: true, message: 'Đã tạo hũ mới!', data: jar.toJSON() });
    } catch (error) {
        console.error('POST /api/jars error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo hũ.' });
    }
});

// PUT /api/jars/:id — Cập nhật thông tin hũ
router.put('/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID hũ không hợp lệ.' });
        }
        const { name, category, icon, target, targetDate, color } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (category !== undefined) updateData.category = (category || 'Mục tiêu chung').trim();
        if (icon !== undefined) updateData.icon = icon;
        if (target !== undefined) {
            if (!isValidVNDAmount(target)) return res.status(400).json({ success: false, message: 'Mục tiêu phải là số nguyên lớn hơn 0 (VNĐ không có phần thập phân).' });
            updateData.target = Number(target);
        }
        if (targetDate !== undefined) updateData.targetDate = targetDate || null;
        if (color !== undefined) updateData.color = color;

        const jar = await Jar.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: updateData },
            { new: true, runValidators: true }
        );
        if (!jar) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }
        res.json({ success: true, message: 'Đã cập nhật hũ!', data: jar.toJSON() });
    } catch (error) {
        console.error('PUT /api/jars/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật hũ.' });
    }
});

// PATCH /api/jars/:id/deposit — Nạp tiền vào hũ (Bọc transaction, Checks-Effects)
router.patch('/:id/deposit', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID hũ không hợp lệ.' });
        }
        const { amount, reason, walletId } = req.body;
        if (!isValidVNDAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Số tiền nạp phải là số nguyên lớn hơn 0.' });
        }

        const amt = Number(amount);

        const updatedJar = await runWithTransaction(async (session) => {
            // 1. CHECKS (đọc thuần, không có side-effect nào)
            let syncWallet = null;
            if (walletId) {
                if (!isValidObjectId(walletId)) {
                    const err = new Error('INVALID_WALLET_ID');
                    err.status = 400;
                    throw err;
                }
                const queryWallet = Wallet.findOne({ _id: walletId, userId: req.user.id, archived: false });
                if (session) queryWallet.session(session);
                syncWallet = await queryWallet;
                if (!syncWallet) {
                    const err = new Error('WALLET_NOT_FOUND');
                    err.status = 400;
                    throw err;
                }
            }

            // 2. EFFECT nguyên tử: dùng $inc/$push trong 1 lệnh findOneAndUpdate duy nhất
            // thay vì đọc document rồi .save() lại — an toàn trước race condition kể cả
            // khi chạy ở nhánh fallback không có session (standalone MongoDB).
            const entry = {
                type: 'deposit',
                amount: amt,
                reason: (reason || '').trim().slice(0, 200),
                date: new Date()
            };
            const updateQuery = Jar.findOneAndUpdate(
                { _id: req.params.id, userId: req.user.id },
                {
                    $inc: { current: amt },
                    $push: { history: { $each: [entry], $position: 0, $slice: 200 } }
                },
                { new: true }
            );
            if (session) updateQuery.session(session);
            const jar = await updateQuery;

            if (!jar) {
                const err = new Error('JAR_NOT_FOUND');
                err.status = 404;
                throw err;
            }

            // Nạp vào hũ là CHUYỂN TIỀN nội bộ (ví -> hũ), không phải chi tiêu thật.
            // Trước đây ghi type: 'expense', category: 'Other Expense' khiến số tiền này
            // cộng dồn vĩnh viễn vào ngân sách "Other Expense" mà không bao giờ được trừ lại
            // khi rút hũ ra — gây ra hiện tượng "Other Expense" phình to bất thường dù
            // người dùng chỉ đang tạm giữ tiền trong hũ. Dùng type: 'transfer' (giống hệt
            // cơ chế chuyển tiền giữa 2 ví) để khoản này bị loại khỏi calculateMonthlyStats
            // (không tính vào category/income/expense) nhưng vẫn trừ đúng số dư ví.
            if (syncWallet) {
                const txPayload = {
                    userId: req.user.id,
                    type: 'transfer',
                    desc: (reason || '').trim() ? `${reason.trim()} (Nạp hũ ${jar.name})` : `Nạp vào hũ ${jar.name}`,
                    amount: amt,
                    category: 'Chuyển vào hũ',
                    date: nowAsVietnamDateAnchor(),
                    walletId: syncWallet._id,
                    jarId: jar._id
                };
                if (session) {
                    await Transaction.create([txPayload], { session });
                } else {
                    await Transaction.create(txPayload);
                }
            }

            return jar;
        });

        res.json({ success: true, message: 'Đã nạp tiền vào hũ!', data: updatedJar.toJSON() });
    } catch (error) {
        if (error.message === 'JAR_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }
        if (error.message === 'INVALID_WALLET_ID' || error.message === 'WALLET_NOT_FOUND') {
            return res.status(400).json({ success: false, message: 'Ví đã chọn không tồn tại hoặc không hợp lệ.' });
        }
        console.error('PATCH /api/jars/:id/deposit error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi khi nạp tiền.' });
    }
});

// PATCH /api/jars/:id/withdraw — Rút tiền từ hũ (Bọc transaction, Checks-Effects)
router.patch('/:id/withdraw', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID hũ không hợp lệ.' });
        }
        const { amount, reason, walletId } = req.body;
        if (!isValidVNDAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Số tiền rút phải là số nguyên lớn hơn 0.' });
        }

        const amt = Number(amount);

        const updatedJar = await runWithTransaction(async (session) => {
            // 1. CHECKS (đọc thuần, không có side-effect nào)
            let syncWallet = null;
            if (walletId) {
                if (!isValidObjectId(walletId)) {
                    const err = new Error('INVALID_WALLET_ID');
                    err.status = 400;
                    throw err;
                }
                const queryWallet = Wallet.findOne({ _id: walletId, userId: req.user.id, archived: false });
                if (session) queryWallet.session(session);
                syncWallet = await queryWallet;
                if (!syncWallet) {
                    const err = new Error('WALLET_NOT_FOUND');
                    err.status = 400;
                    throw err;
                }
            }

            // 2. EFFECT nguyên tử: điều kiện "current >= amt" nằm ngay trong filter của
            // findOneAndUpdate, nên việc kiểm tra số dư và trừ tiền diễn ra atomic trong
            // 1 lệnh Mongo duy nhất — an toàn trước race condition kể cả khi chạy fallback
            // không có session (không còn tách rời đọc-so sánh-ghi như trước).
            const entry = {
                type: 'withdraw',
                amount: amt,
                reason: (reason || '').trim().slice(0, 200),
                date: nowAsVietnamDateAnchor()
            };
            const updateQuery = Jar.findOneAndUpdate(
                { _id: req.params.id, userId: req.user.id, current: { $gte: amt } },
                {
                    $inc: { current: -amt },
                    $push: { history: { $each: [entry], $position: 0, $slice: 200 } }
                },
                { new: true }
            );
            if (session) updateQuery.session(session);
            let jar = await updateQuery;

            if (!jar) {
                // Không match được filter -> phân biệt rõ 2 trường hợp: hũ không tồn tại
                // hay chỉ đơn giản là không đủ số dư.
                const checkQuery = Jar.findOne({ _id: req.params.id, userId: req.user.id });
                if (session) checkQuery.session(session);
                const exists = await checkQuery;
                if (!exists) {
                    const err = new Error('JAR_NOT_FOUND');
                    err.status = 404;
                    throw err;
                }
                const err = new Error('INSUFFICIENT_BALANCE');
                err.status = 400;
                throw err;
            }

            // Rút từ hũ cũng là CHUYỂN TIỀN nội bộ (hũ -> ví), không phải thu nhập thật.
            // Trước đây ghi type: 'income', category: 'Other Income' khiến "Thu nhập tháng này"
            // bị thổi phồng bởi chính tiền của người dùng quay vòng lại, chứ không phải tiền
            // kiếm được mới. Dùng type: 'transfer' với toWalletId để cộng đúng vào ví nhận mà
            // không tính vào income/expense hay bất kỳ ngân sách danh mục nào.
            if (syncWallet) {
                const txPayload = {
                    userId: req.user.id,
                    type: 'transfer',
                    desc: (reason || '').trim() ? `${reason.trim()} (Rút từ hũ ${jar.name})` : `Rút từ hũ ${jar.name}`,
                    amount: amt,
                    category: 'Chuyển từ hũ',
                    date: nowAsVietnamDateAnchor(),
                    toWalletId: syncWallet._id,
                    jarId: jar._id
                };
                if (session) {
                    await Transaction.create([txPayload], { session });
                } else {
                    await Transaction.create(txPayload);
                }
            }

            return jar;
        });

        res.json({ success: true, message: 'Đã rút tiền từ hũ!', data: updatedJar.toJSON() });
    } catch (error) {
        if (error.message === 'JAR_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }
        if (error.message === 'INSUFFICIENT_BALANCE') {
            return res.status(400).json({ success: false, message: 'Số tiền rút vượt quá số dư trong hũ.' });
        }
        if (error.message === 'INVALID_WALLET_ID' || error.message === 'WALLET_NOT_FOUND') {
            return res.status(400).json({ success: false, message: 'Ví đã chọn không tồn tại hoặc không hợp lệ.' });
        }
        console.error('PATCH /api/jars/:id/withdraw error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi khi rút tiền.' });
    }
});

// DELETE /api/jars/:id — Xóa hũ và dọn dẹp các giao dịch liên quan
router.delete('/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID hũ không hợp lệ.' });
        }
        const deleted = await Jar.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hũ.' });
        }

        // Tự động dọn sạch các giao dịch liên kết với hũ này để tránh giao dịch mồ côi
        await Transaction.deleteMany({ jarId: req.params.id, userId: req.user.id });

        res.json({ success: true, message: 'Đã xóa hũ và dọn dẹp các giao dịch liên quan!' });
    } catch (error) {
        console.error('DELETE /api/jars/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa hũ.' });
    }
});

/* =============================================
   INSTALLMENTS (TRẢ GÓP & HÓA ĐƠN ĐỊNH KỲ)
   ============================================= */

// GET /api/jars/installments — Lấy tất cả khoản định kỳ của user
router.get('/installments', async (req, res) => {
    try {
        const items = await Installment.find({ userId: req.user.id }).sort({ nextDueDate: 1 });
        res.json({ success: true, data: items.map(i => i.toJSON()) });
    } catch (error) {
        console.error('GET /api/jars/installments error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách trả góp.' });
    }
});

// POST /api/jars/installments — Tạo khoản định kỳ mới (Điểm 7: bắt buộc category)
router.post('/installments', async (req, res) => {
    try {
        const { name, icon, amount, cycle, nextDueDate, category } = req.body;

        if (!name || !amount || !cycle || !nextDueDate) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin bắt buộc.' });
        }
        if (!category || typeof category !== 'string' || !category.trim()) {
            return res.status(400).json({ success: false, message: 'Danh mục khoản định kỳ không được để trống.' });
        }
        if (!['monthly', 'quarterly', 'yearly'].includes(cycle)) {
            return res.status(400).json({ success: false, message: 'Chu kỳ không hợp lệ.' });
        }
        if (!isValidVNDAmount(amount)) {
            return res.status(400).json({ success: false, message: 'Số tiền phải là số nguyên lớn hơn 0.' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
        }

        const item = await Installment.create({
            userId: req.user.id,
            name: name.trim(),
            category: category.trim(),
            icon: icon || '💳',
            amount: Number(amount),
            cycle,
            nextDueDate,
            active: true,
            totalPaid: 0
        });

        // Tự động đảm bảo category có trong collection Category của user (best-effort, không chặn response)
        await Category.ensureCategorySafe(req.user.id, category);

        res.status(201).json({ success: true, message: 'Đã thêm khoản định kỳ!', data: item.toJSON() });
    } catch (error) {
        console.error('POST /api/jars/installments error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi tạo khoản định kỳ.' });
    }
});

// PUT /api/jars/installments/:id — Sửa khoản định kỳ (Điểm 6: cho phép cập nhật category)
router.put('/installments/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID khoản định kỳ không hợp lệ.' });
        }

        const item = await Installment.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }

        const { name, icon, amount, cycle, nextDueDate, category } = req.body;
        if (name !== undefined) {
            if (!name.trim()) return res.status(400).json({ success: false, message: 'Tên không được để trống.' });
            item.name = name.trim();
        }
        if (icon !== undefined) item.icon = icon;
        if (amount !== undefined) {
            if (!isValidVNDAmount(amount)) return res.status(400).json({ success: false, message: 'Số tiền phải là số nguyên lớn hơn 0.' });
            item.amount = Number(amount);
        }
        if (cycle !== undefined) {
            if (!['monthly', 'quarterly', 'yearly'].includes(cycle)) {
                return res.status(400).json({ success: false, message: 'Chu kỳ không hợp lệ.' });
            }
            item.cycle = cycle;
        }
        if (nextDueDate !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
                return res.status(400).json({ success: false, message: 'Định dạng ngày không hợp lệ (YYYY-MM-DD).' });
            }
            item.nextDueDate = nextDueDate;
        }
        if (category !== undefined) {
            if (!category.trim()) return res.status(400).json({ success: false, message: 'Danh mục không được để trống.' });
            item.category = category.trim();
            await Category.ensureCategorySafe(req.user.id, category);
        }

        await item.save();

        res.json({ success: true, message: 'Đã cập nhật khoản định kỳ!', data: item.toJSON() });
    } catch (error) {
        console.error('PUT /api/jars/installments/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật khoản định kỳ.' });
    }
});

function advanceNextDueDate(dateStr, cycle) {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    let targetYear = year;
    let targetMonth = month;
    if (cycle === 'monthly') {
        targetMonth = month + 1;
        if (targetMonth > 11) {
            targetYear += Math.floor(targetMonth / 12);
            targetMonth = targetMonth % 12;
        }
    } else if (cycle === 'quarterly') {
        targetMonth = month + 3;
        if (targetMonth > 11) {
            targetYear += Math.floor(targetMonth / 12);
            targetMonth = targetMonth % 12;
        }
    } else if (cycle === 'yearly') {
        targetYear += 1;
    }

    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, daysInTargetMonth);

    const pad = n => String(n).padStart(2, '0');
    return `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}`;
}

// PATCH /api/jars/installments/:id/pay — Đánh dấu "Đã trả kỳ này" (Bọc transaction, tự động sinh Transaction Expense)
router.patch('/installments/:id/pay', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID khoản định kỳ không hợp lệ.' });
        }

        const { walletId } = req.body || {};

        const updatedItem = await runWithTransaction(async (session) => {
            // 1. CHECKS
            const queryItem = Installment.findOne({ _id: req.params.id, userId: req.user.id });
            if (session) queryItem.session(session);
            const item = await queryItem;

            if (!item) {
                const err = new Error('INSTALLMENT_NOT_FOUND');
                err.status = 404;
                throw err;
            }

            let payWallet = null;
            if (walletId) {
                // Đã truyền walletId tường minh -> phải hợp lệ, không âm thầm fallback
                // sang ví khác nếu sai (tránh trừ nhầm ví mà người dùng không hay biết).
                if (!isValidObjectId(walletId)) {
                    const err = new Error('INVALID_WALLET_ID');
                    err.status = 400;
                    throw err;
                }
                const queryW = Wallet.findOne({ _id: walletId, userId: req.user.id, archived: false });
                if (session) queryW.session(session);
                payWallet = await queryW;
                if (!payWallet) {
                    const err = new Error('WALLET_NOT_FOUND');
                    err.status = 400;
                    throw err;
                }
            } else {
                // Không truyền walletId -> fallback về ví mặc định hoặc ví bất kỳ
                const queryDef = Wallet.findOne({ userId: req.user.id, isDefault: true, archived: false });
                if (session) queryDef.session(session);
                payWallet = await queryDef;

                if (!payWallet) {
                    const queryAny = Wallet.findOne({ userId: req.user.id, archived: false });
                    if (session) queryAny.session(session);
                    payWallet = await queryAny;
                }
            }

            // 2. EFFECTS
            const prevDueDate = item.nextDueDate;
            const nextDate = advanceNextDueDate(item.nextDueDate, item.cycle);

            const todayDate = getVietnamTodayString();
            const historyEntry = {
                amount: item.amount,
                paidDate: todayDate,
                cycleDate: prevDueDate,
                createdAt: new Date()
            };

            if (!Array.isArray(item.history)) item.history = [];
            item.history.unshift(historyEntry);
            if (item.history.length > 200) item.history = item.history.slice(0, 200);

            item.nextDueDate = nextDate;
            item.totalPaid = (item.totalPaid || 0) + item.amount;
            await item.save(session ? { session } : {});

            // Sinh Transaction Expense với category động của item
            const txPayload = {
                userId: req.user.id,
                type: 'expense',
                desc: `Thanh toán định kỳ: ${item.name}`,
                amount: item.amount,
                category: item.category || 'Housing & Bills',
                date: nowAsVietnamDateAnchor(),
                walletId: payWallet ? payWallet._id : null,
                installmentId: item._id
            };
            if (session) {
                await Transaction.create([txPayload], { session });
            } else {
                await Transaction.create(txPayload);
            }

            return item;
        });

        res.json({ success: true, message: 'Đã đánh dấu thanh toán và ghi nhận chi tiêu!', data: updatedItem.toJSON() });
    } catch (error) {
        if (error.message === 'INSTALLMENT_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }
        if (error.message === 'INVALID_WALLET_ID' || error.message === 'WALLET_NOT_FOUND') {
            return res.status(400).json({ success: false, message: 'Ví thanh toán đã chọn không tồn tại hoặc không hợp lệ.' });
        }
        console.error('PATCH /api/jars/installments/:id/pay error:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Lỗi khi cập nhật kỳ thanh toán.' });
    }
});

// PATCH /api/jars/installments/:id/toggle — Bật/tắt theo dõi khoản định kỳ
router.patch('/installments/:id/toggle', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID khoản định kỳ không hợp lệ.' });
        }
        const item = await Installment.findOne({ _id: req.params.id, userId: req.user.id });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }
        item.active = !item.active;
        await item.save();
        res.json({ success: true, data: item.toJSON() });
    } catch (error) {
        console.error('PATCH /api/jars/installments/:id/toggle error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi cập nhật trạng thái.' });
    }
});

// DELETE /api/jars/installments/:id — Xóa khoản định kỳ và dọn dẹp các giao dịch liên quan
router.delete('/installments/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'ID khoản định kỳ không hợp lệ.' });
        }
        const deleted = await Installment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy khoản định kỳ.' });
        }

        // Tự động dọn sạch các giao dịch liên kết với khoản định kỳ này
        await Transaction.deleteMany({ installmentId: req.params.id, userId: req.user.id });

        res.json({ success: true, message: 'Đã xóa khoản định kỳ và dọn dẹp các giao dịch liên quan!' });
    } catch (error) {
        console.error('DELETE /api/jars/installments/:id error:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi xóa khoản định kỳ.' });
    }
});

module.exports = router;
