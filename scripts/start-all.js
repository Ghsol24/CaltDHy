const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backEnd', 'server');
const frontendDir = path.join(rootDir, 'frontEnd-react');

console.log('========================================================');
console.log('🚀 Đang khởi động hệ thống CaltDHy (Backend + Frontend)...');
console.log('========================================================');

// Khởi động Backend
const backend = spawn('node', ['server.js'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env }
});

// Khởi động Frontend (React / Vite)
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: { ...process.env }
});

let opened = false;
setTimeout(() => {
  if (!opened) {
    opened = true;
    console.log('\n🌐 Đang mở trình duyệt tại: http://localhost:5173 ...\n');
    spawn('open', ['http://localhost:5173']);
  }
}, 2500);

const cleanup = () => {
  console.log('\n🛑 Đang dừng toàn bộ dịch vụ CaltDHy...');
  try { backend.kill('SIGTERM'); } catch {}
  try { frontend.kill('SIGTERM'); } catch {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
