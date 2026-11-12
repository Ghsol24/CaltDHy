'use strict';
// Tạo cặp khóa VAPID cho thông báo đẩy. Chạy một lần cho mỗi môi trường, trong terminal riêng:
//   node backEnd/server/scripts/generate-vapid-keys.js
// Chép hai dòng in ra vào .env hoặc biến môi trường của server. VAPID_PRIVATE_KEY là bí mật.
// Đổi khóa sẽ làm mọi thiết bị đã bật thông báo phải bật lại.
const crypto = require('node:crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const point = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
void publicKey;
console.log('VAPID_PUBLIC_KEY=' + point.toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
