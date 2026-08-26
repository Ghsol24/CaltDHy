const mongoose = require('mongoose');

/**
 * Thực thi một khối tác vụ bên trong MongoDB Transaction có cơ chế Graceful Fallback.
 *
 * Đảm bảo:
 * 1. Nếu môi trường là Replica Set (MongoDB Atlas / Replica Set):
 *    Sử dụng session.withTransaction() để đảm bảo tính nguyên tử (Atomicity - ACID).
 * 2. Graceful Fallback:
 *    Nếu bắt lỗi Mongo Code 20 ("Transaction numbers are only allowed on a replica set...")
 *    hoặc thông báo chứa "replica set", tự động fallback chạy tuần tự không session.
 * 3. Bất kỳ lỗi logic/business nào (vd: không đủ tiền, hũ không tồn tại) được ném ra bên trong workFn
 *    sẽ kích hoạt abort session tự động và re-throw ra ngoài cho route handler xử lý.
 *
 * @param {Function} workFn - Hàm async nhận param (session)
 * @returns {Promise<any>}
 */
async function runWithTransaction(workFn) {
    let session = null;
    try {
        session = await mongoose.startSession();
        let result;
        await session.withTransaction(async () => {
            result = await workFn(session);
        });
        return result;
    } catch (error) {
        const isNotReplicaSet =
            error.code === 20 ||
            (typeof error.message === 'string' && (
                error.message.includes('replica set') ||
                error.message.includes('standalone') ||
                error.message.includes('Transaction numbers are only allowed')
            ));

        if (isNotReplicaSet) {
            return await workFn(null);
        }
        throw error;
    } finally {
        if (session) {
            await session.endSession();
        }
    }
}

module.exports = { runWithTransaction };
