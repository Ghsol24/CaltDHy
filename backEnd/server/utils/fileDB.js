const fs = require('fs/promises');
const path = require('path');

// data.json is at CaltDHy/ (project root)
// This file is at CaltDHy/backEnd/server/utils/fileDB.js
// So we go up 3 levels: utils -> server -> backEnd -> CaltDHy
const DB_PATH = path.join(__dirname, '..', '..', '..', 'data.json');

const DEFAULT_DB = {
    events: [],
    spendings: [],
    budgets: [],
    users: []
};

/**
 * Đọc toàn bộ dữ liệu từ data.json
 * Nếu file chưa tồn tại, tạo mới với cấu trúc mặc định
 */
async function readData() {
    try {
        const raw = await fs.readFile(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);

        // Đảm bảo luôn có đủ các key, tránh lỗi undefined
        return {
            events: parsed.events ?? [],
            spendings: parsed.spendings ?? [],
            budgets: parsed.budgets ?? [],
            users: parsed.users ?? []
        };
    } catch (err) {
        // File chưa tồn tại hoặc JSON lỗi -> khởi tạo mặc định
        if (err.code === 'ENOENT' || err instanceof SyntaxError) {
            await writeData(DEFAULT_DB);
            return { ...DEFAULT_DB };
        }
        throw err;
    }
}

/**
 * Ghi toàn bộ dữ liệu vào data.json
 * @param {object} data - Object chứa toàn bộ DB
 */
async function writeData(data) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readData, writeData };
