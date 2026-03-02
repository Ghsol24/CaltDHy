/* =============================================
   calendar.js – DEMO MODE (localStorage, không cần server)
   projectcanhan.com
   ============================================= */

// ---- Auth Guard ----
const token = localStorage.getItem('pcn_token');
const userStr = localStorage.getItem('pcn_user');

if (!token) {
    window.location.href = 'index.html';
}

// ---- User Info ----
let currentUser = null;
if (userStr) {
    currentUser = JSON.parse(userStr);
    const nameEl = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (avatarEl) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
}

// ---- State ----
// Read ?y=YYYY&m=MM from month-picker.html navigation, fallback to today
(function initDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const y = parseInt(params.get('y'));
    const m = parseInt(params.get('m')); // 1-indexed
    if (y && m && m >= 1 && m <= 12) {
        window.currentDate = new Date(y, m - 1, 1);
    } else {
        window.currentDate = new Date();
    }
})();
let currentDate = window.currentDate;
let editingEventId = null;
let currentDayDetailDate = null; // ngày đang mở trong Day Detail Popup
// =============================================
// API HELPERS (ĐÃ NÂNG CẤP LÊN MONGODB BỞI AI)
// =============================================
const API_BASE = 'https://caltdhy.onrender.com/api/events';

async function fetchEventsFromServer(year, month) {
    try {
        const res = await fetch(`${API_BASE}?year=${year}&month=${month}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        return data.success ? data.data : [];
    } catch (err) {
        console.error("Lỗi lấy lịch trình từ server:", err);
        return [];
    }
}
// =============================================
// Toast
// =============================================
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// =============================================
// Logout
// =============================================
function handleLogout() {
    localStorage.removeItem('pcn_token');
    localStorage.removeItem('pcn_user');
    window.location.href = 'index.html';
}

// =============================================
// CALENDAR RENDERING
// =============================================
function updateMonthTitle() {
    const months = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
        'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
        'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    const el = document.getElementById('monthTitle');
    if (el) el.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
}

function changeMonth(delta) {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    loadCalendar();
}

function goToday() {
    currentDate = new Date();
    loadCalendar();
}

function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/* Chuyển màu hex sang rgba với alpha cho event pill */
function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

function renderCalendar(events) {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = toDateStr(new Date());

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    // Build events map
    const eventsMap = {};
    events.forEach(evt => {
        if (!eventsMap[evt.date]) eventsMap[evt.date] = [];
        eventsMap[evt.date].push(evt);
    });

    for (let i = 0; i < totalCells; i++) {
        let cellDate, isOtherMonth = false;

        if (i < firstDay) {
            cellDate = new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1);
            isOtherMonth = true;
        } else if (i >= firstDay + daysInMonth) {
            cellDate = new Date(year, month + 1, i - firstDay - daysInMonth + 1);
            isOtherMonth = true;
        } else {
            cellDate = new Date(year, month, i - firstDay + 1);
        }

        const dateStr = toDateStr(cellDate);
        const dayOfWeek = cellDate.getDay();
        const dayEvents = eventsMap[dateStr] || [];

        const classes = ['day-cell'];
        if (isOtherMonth) classes.push('other-month');
        if (dateStr === today) classes.push('today');
        // Ngày đã qua (không phải hôm nay) → mờ hơn
        if (dateStr < today && !isOtherMonth) classes.push('past-day');
        if (dayOfWeek === 0) classes.push('sunday');
        if (dayOfWeek === 6) classes.push('saturday');
        // UI: ô có task → nền hơi tối hơn bình thường
        if (dayEvents.length > 0) classes.push('has-events');

        const cell = document.createElement('div');
        cell.className = classes.join(' ');
        cell.dataset.date = dateStr;

        // Click vào ô ngày → mở Day Detail Popup
        cell.onclick = () => openDayDetail(dateStr);

        // Header: số ngày + nút +
        const numRow = document.createElement('div');
        numRow.className = 'day-number-row';

        const dayNum = document.createElement('span');
        dayNum.className = 'day-number';
        dayNum.textContent = cellDate.getDate();

        const addBtn = document.createElement('button');
        addBtn.className = 'add-event-btn';
        addBtn.title = 'Thêm lịch trình';
        addBtn.textContent = '+';
        // Chặn click nổi lên ô ngày
        addBtn.onclick = (e) => { e.stopPropagation(); openModal(null, dateStr); };

        // Copy button – below the + button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-event-btn';
        copyBtn.title = 'Sao chép lịch trình từ ngày khác';
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="9" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-7A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
        copyBtn.onclick = (e) => { e.stopPropagation(); openCopyModal(dateStr); };

        numRow.appendChild(dayNum);
        numRow.appendChild(addBtn);
        numRow.appendChild(copyBtn);
        cell.appendChild(numRow);

        // Event pills (tối đa 3) – màu bán trong suốt
        const maxShow = 3;
        dayEvents.slice(0, maxShow).forEach(evt => cell.appendChild(createEventPill(evt)));

        if (dayEvents.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'more-events';
            more.textContent = `+${dayEvents.length - maxShow} khác`;
            more.onclick = (e) => { e.stopPropagation(); openDayDetail(dateStr); };
            cell.appendChild(more);
        }

        grid.appendChild(cell);
    }
}

/* =============================================
   COPY SCHEDULE MODAL
   ============================================= */
let _copyTargetDate = null; // the date cell the user clicked copy on

function openCopyModal(targetDateStr) {
    _copyTargetDate = targetDateStr;
    // Set min/max to reasonable range
    const srcInput = document.getElementById('copySourceDate');
    if (srcInput) {
        srcInput.value = '';
    }
    const modal = document.getElementById('copyScheduleModal');
    if (modal) {
        modal.style.display = 'flex';
        const info = document.getElementById('copyTargetInfo');
        if (info) {
            const d = new Date(targetDateStr + 'T00:00:00');
            info.textContent = `Ngày đích: ${d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
    }
}

function closeCopyModal() {
    const modal = document.getElementById('copyScheduleModal');
    if (modal) modal.style.display = 'none';
    _copyTargetDate = null;
}

function handleCopySchedule() {
    const srcDate = document.getElementById('copySourceDate').value; // YYYY-MM-DD
    if (!srcDate) { alert('Vui l\u00f2ng ch\u1ecdn ng\u00e0y ngu\u1ed3n.'); return; }
    if (!_copyTargetDate) { closeCopyModal(); return; }
    if (srcDate === _copyTargetDate) { alert('Ng\u00e0y ngu\u1ed3n v\u00e0 ng\u00e0y \u0111\u00edch kh\u00f4ng \u0111\u01b0\u1ee3c tr\u00f9ng nhau.'); return; }

    const RED_COLOR = '#e74c3c';
    const allEvents = getAllEvents(); // ✅ correct function

    // Filter red events from the source date
    const redEvents = allEvents.filter(e => e.date === srcDate && e.color === RED_COLOR);
    if (redEvents.length === 0) {
        alert('Kh\u00f4ng t\u00ecm th\u1ea5y l\u1ecbch tr\u00ecnh m\u00e0u \u0111\u1ecf n\u00e0o v\u00e0o ng\u00e0y n\u00e0y.');
        return;
    }

    // Clone each red event onto the target date with a fresh unique ID
    const ts = Date.now();
    const clones = redEvents.map((e, idx) => ({
        ...e,
        id: `evt_copy_${ts}_${idx}_${Math.random().toString(36).slice(2)}`,
        date: _copyTargetDate
    }));

    const updatedEvents = [...allEvents, ...clones];
    saveAllEvents(updatedEvents); // ✅ correct function

    showToast(`\u2705 \u0110\u00e3 sao ch\u00e9p ${clones.length} l\u1ecbch tr\u00ecnh m\u00e0u \u0111\u1ecf sang ng\u00e0y \u0111\u00edch!`);
    closeCopyModal();
    loadCalendar(); // Re-render calendar immediately
}


function createEventPill(evt) {
    const pill = document.createElement('div');
    pill.className = 'event-pill';
    // Màu bán trong suốt (alpha 0.55) thay vì màu đặc
    const baseColor = evt.color || '#1877F2';
    pill.style.background = hexToRgba(baseColor, 0.55);
    pill.style.borderLeft = `3px solid ${hexToRgba(baseColor, 0.9)}`;
    pill.title = evt.title + (evt.startTime ? ` (${evt.startTime})` : '');

    if (evt.startTime) {
        const t = document.createElement('span');
        t.className = 'event-time';
        t.textContent = evt.startTime;
        pill.appendChild(t);
    }

    const s = document.createElement('span');
    s.textContent = evt.title;
    pill.appendChild(s);

    // Click vào pill → mở modal sửa (không mở day detail)
    pill.onclick = (e) => { e.stopPropagation(); openModal(evt); };
    return pill;
}

// ---- Cập nhật hàm Load Lịch sang bản ASYNC (MỚI) ----
async function loadCalendar() {
    const loadingEl = document.getElementById('calendarLoading');
    const wrapperEl = document.getElementById('calendarWrapper');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (wrapperEl) wrapperEl.style.display = 'none';

    updateMonthTitle();

    // Triệu hồi dữ liệu từ Server Render thay vì localStorage
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const events = await fetchEventsFromServer(year, month);

    renderCalendar(events);

    if (loadingEl) loadingEl.style.display = 'none';
    if (wrapperEl) wrapperEl.style.display = 'block';
}

// =============================================
// DAY DETAIL POPUP
// =============================================
function openDayDetail(dateStr) {
    currentDayDetailDate = dateStr;

    // Tiêu đề "Ngày X"
    const parts = dateStr.split('-');
    const dayNum = parseInt(parts[2]);
    document.getElementById('dayDetailTitle').textContent = `Ngày ${dayNum}`;

    renderDayDetailBody(dateStr);

    document.getElementById('dayDetailModal').style.display = 'flex';
}

function closeDayDetail() {
    document.getElementById('dayDetailModal').style.display = 'none';
    currentDayDetailDate = null;
}

function closeDayDetailOnOverlay(e) {
    if (e.target === document.getElementById('dayDetailModal')) closeDayDetail();
}

function renderDayDetailBody(dateStr) {
    const body = document.getElementById('dayDetailBody');
    body.innerHTML = '';

    const allEvents = getAllEvents();
    const dayEvents = allEvents.filter(e => e.date === dateStr);

    if (dayEvents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'day-detail-empty-state';
        empty.title = 'Nhấn để thêm lịch trình';
        empty.innerHTML = '<span>✦ Thêm lịch trình của bạn ngay bây giờ</span>';
        empty.onclick = () => {
            closeDayDetail();
            openModal(null, dateStr);
        };
        body.appendChild(empty);
        return;
    }

    // Sắp xếp theo giờ bắt đầu
    dayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    dayEvents.forEach(evt => {
        const row = document.createElement('div');
        row.className = 'task-row';

        // Phần thông tin task
        const info = document.createElement('div');
        info.className = 'task-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = evt.title;

        const timeEl = document.createElement('div');
        timeEl.className = 'task-time';
        if (evt.startTime) {
            timeEl.textContent = evt.endTime
                ? `${evt.startTime} – ${evt.endTime}`
                : evt.startTime;
        } else {
            timeEl.textContent = 'Chưa đặt giờ';
        }

        info.appendChild(titleEl);
        info.appendChild(timeEl);

        // Nút xóa task
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'task-delete-btn';
        deleteBtn.title = 'Xóa task này';
        deleteBtn.textContent = '🗑';
        deleteBtn.onclick = () => handleDeleteTaskFromPopup(evt.id, dateStr);

        // Ô trạng thái
        const statusBox = document.createElement('div');
        statusBox.className = 'task-status-box';
        statusBox.dataset.eventId = evt.id;
        applyStatusUI(statusBox, evt.status || '');

        // Click để toggle done / bỏ done
        statusBox.onclick = () => {
            const current = evt.status || '';
            if (current === 'done') {
                setTaskStatus(evt.id, '');
                evt.status = '';
            } else {
                setTaskStatus(evt.id, 'done');
                evt.status = 'done';
            }
            applyStatusUI(statusBox, evt.status);
            loadCalendar();
        };

        row.appendChild(info);
        row.appendChild(deleteBtn);
        row.appendChild(statusBox);
        body.appendChild(row);
    });
}

/* Xóa task ngay từ Day Detail Popup */
function handleDeleteTaskFromPopup(eventId, dateStr) {
    const events = getAllEvents().filter(e => e.id !== eventId);
    saveAllEvents(events);
    // Refresh popup và lịch chính
    renderDayDetailBody(dateStr);
    loadCalendar();
    showToast('🗑 Đã xóa lịch trình!');
}

function applyStatusUI(el, status) {
    el.className = 'task-status-box';
    switch (status) {
        case 'done':
            el.classList.add('status-done');
            el.textContent = '✓';
            break;
        case 'warn':
            el.classList.add('status-warn');
            el.textContent = 'O';
            break;
        case 'fail':
            el.classList.add('status-fail');
            el.textContent = '✗';
            break;
        default:
            el.textContent = '';
            break;
    }
}

/* Lưu trạng thái task vào localStorage */
function setTaskStatus(eventId, newStatus) {
    const events = getAllEvents();
    const idx = events.findIndex(e => e.id === eventId);
    if (idx !== -1) {
        events[idx].status = newStatus;
        // Đánh dấu đã gửi notify nếu done/fail
        if (newStatus === 'done') {
            events[idx].notified = false; // reset notify nếu muốn toggle lại
        }
        saveAllEvents(events);
    }
}

// =============================================
// MODAL – Thêm / Sửa / Xóa
// =============================================
function openModal(event = null, dateStr = null) {
    editingEventId = null;
    clearModalForm();

    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteBtn');

    if (event) {
        editingEventId = event.id;
        modalTitle.textContent = '✏️ Sửa lịch trình';
        deleteBtn.style.display = 'inline-flex';

        document.getElementById('eventTitle').value = event.title || '';
        document.getElementById('eventDate').value = event.date || '';
        setTimePicker('start', event.startTime || '');
        setTimePicker('end', event.endTime || '');
        document.getElementById('eventDesc').value = event.description || '';

        const colorVal = event.color || '#1877F2';
        const radios = document.querySelectorAll('input[name="eventColor"]');
        let matched = false;
        radios.forEach(r => { if (r.value === colorVal) { r.checked = true; matched = true; } });
        if (!matched) radios[0].checked = true;

        // Restore notify toggle
        const nt = document.getElementById('notifyToggle');
        if (nt) nt.checked = !!event.notify;
    } else {
        modalTitle.textContent = '➕ Thêm lịch trình';
        deleteBtn.style.display = 'none';
        if (dateStr) document.getElementById('eventDate').value = dateStr;
        document.querySelector('input[name="eventColor"]').checked = true;
    }

    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('eventTitle').focus(), 100);
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
    editingEventId = null;
    clearModalForm();
}

function closeModalOnOverlay(e) {
    if (e.target === document.getElementById('eventModal')) closeModal();
}

function clearModalForm() {
    ['eventTitle', 'eventDate', 'eventStart', 'eventEnd', 'eventDesc']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const err = document.getElementById('modalError');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    // Reset time picker UIs to blank (index 0 = placeholder)
    resetTimePicker('start');
    resetTimePicker('end');
    // Reset notification toggle
    const nt = document.getElementById('notifyToggle');
    if (nt) nt.checked = false;
}

// =============================================
// CUSTOM TIME PICKER HELPERS (Minute → Hour → AM/PM)
// =============================================

/* Populate Minute & Hour selects once on load */
function initTimePickers() {
    ['startMin', 'endMin'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">--</option>';
        for (let m = 0; m < 60; m++) {
            const val = String(m).padStart(2, '0');
            sel.innerHTML += `<option value="${val}">${val}</option>`;
        }
    });
    ['startHour', 'endHour'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">--</option>';
        for (let h = 1; h <= 12; h++) {
            const val = String(h).padStart(2, '0');
            sel.innerHTML += `<option value="${val}">${val}</option>`;
        }
    });
}

/* Sync custom dropdowns → hidden input value (HH:MM, 24h) */
function syncTimePicker(prefix) {
    const minEl = document.getElementById(prefix + 'Min');
    const hourEl = document.getElementById(prefix + 'Hour');
    const ampmEl = document.getElementById(prefix + 'AmPm');
    const hiddenEl = document.getElementById('event' + (prefix === 'start' ? 'Start' : 'End'));

    const min = minEl ? minEl.value : '';
    const hour12 = hourEl ? hourEl.value : '';
    const ampm = ampmEl ? ampmEl.value : 'AM';

    if (!min || !hour12) {
        if (hiddenEl) hiddenEl.value = '';
        return;
    }

    let h = parseInt(hour12, 10);
    if (ampm === 'AM') {
        if (h === 12) h = 0;
    } else {
        if (h !== 12) h += 12;
    }
    const hStr = String(h).padStart(2, '0');
    if (hiddenEl) hiddenEl.value = `${hStr}:${min}`;
}

/* Set custom dropdowns from a HH:MM (24h) string when editing */
function setTimePicker(prefix, timeStr) {
    if (!timeStr) {
        resetTimePicker(prefix);
        return;
    }
    const [hRaw, mRaw] = timeStr.split(':');
    let h = parseInt(hRaw, 10);
    const m = mRaw || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    const hourStr = String(h).padStart(2, '0');

    const minEl = document.getElementById(prefix + 'Min');
    const hourEl = document.getElementById(prefix + 'Hour');
    const ampmEl = document.getElementById(prefix + 'AmPm');
    if (minEl) minEl.value = m;
    if (hourEl) hourEl.value = hourStr;
    if (ampmEl) ampmEl.value = ampm;

    // Also sync back to hidden input
    syncTimePicker(prefix);
}

/* Reset dropdowns to blank */
function resetTimePicker(prefix) {
    const minEl = document.getElementById(prefix + 'Min');
    const hourEl = document.getElementById(prefix + 'Hour');
    const ampmEl = document.getElementById(prefix + 'AmPm');
    if (minEl) minEl.value = '';
    if (hourEl) hourEl.value = '';
    if (ampmEl) ampmEl.value = 'AM';
    const hiddenEl = document.getElementById('event' + (prefix === 'start' ? 'Start' : 'End'));
    if (hiddenEl) hiddenEl.value = '';
}

function getSelectedColor() {
    const r = document.querySelector('input[name="eventColor"]:checked');
    return r ? r.value : '#1877F2';
}

// ---- Lưu (Thêm hoặc Sửa) ----
async function handleSaveEvent() {// --- ĐOẠN CODE LƯU LỊCH TRÌNH LÊN MONGODB (MỚI) ---
    const eventData = { title, date, startTime, endTime, description, color, notify };
    const url = editingEventId ? `${API_BASE}/${editingEventId}` : API_BASE;
    const method = editingEventId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(eventData)
        });
        const result = await res.json();

        if (result.success) {
            showToast(editingEventId ? '✅ Đã cập nhật lịch!' : '✅ Đã thêm lịch trình!', 'success');
            closeModal();
            loadCalendar(); // Load lại để đồng bộ ID từ Database
        } else {
            showModalError(result.message || 'Lỗi khi lưu dữ liệu.');
        }
    } catch (err) {
        showModalError('Không thể kết nối server Render.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Lưu';
    }
}

// ---- Xóa ----
async function handleDeleteEvent() {
    if (!editingEventId) return;
    if (!confirm('Bạn có chắc muốn xóa lịch trình này không?')) return;

    try {
        const res = await fetch(`${API_BASE}/${editingEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();

        if (result.success) {
            showToast('🗑 Đã xóa khỏi hệ thống!');
            closeModal();
            loadCalendar();
            if (currentDayDetailDate) renderDayDetailBody(currentDayDetailDate);
        }
    } catch (err) {
        showToast('Lỗi khi xóa dữ liệu!', 'error');
    }
}
function showModalError(message) {
    const err = document.getElementById('modalError');
    err.textContent = message;
    err.style.display = 'block';
}

// =============================================
// LOGIC TRẠNG THÁI TASK & THÔNG BÁO
// setInterval chạy mỗi 60 giây
// =============================================

/* Tính thời gian hẹn (Date object) từ event */
function getScheduledTime(evt) {
    if (!evt.date || !evt.startTime) return null;
    const [h, m] = evt.startTime.split(':').map(Number);
    const d = new Date(evt.date);
    d.setHours(h, m, 0, 0);
    return d;
}

/* Xin quyền Desktop Notification */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/* Gửi Desktop Notification */
function sendDesktopNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '📅',
            tag: 'pcn-task-reminder'
        });
    }
}

/* Kiểm tra tất cả task và đổi trạng thái tự động */
function checkTaskStatuses() {
    const now = new Date();
    const THREE_HOURS = 3 * 60 * 60 * 1000; // ms
    const SIX_HOURS = 6 * 60 * 60 * 1000; // ms

    const events = getAllEvents();
    let changed = false;

    events.forEach(evt => {
        // Bỏ qua task đã done hoặc không có startTime
        if (evt.status === 'done') return;
        if (!evt.startTime) return;

        const scheduled = getScheduledTime(evt);
        if (!scheduled) return;

        const diff = now - scheduled; // ms đã qua kể từ giờ hẹn

        // ✅ Fire start-time alert for events with notify:true (within 2 min window)
        if (evt.notify && !evt.notified && diff >= 0 && diff <= 2 * 60 * 1000) {
            sendDesktopNotification(
                `⏰ Bắt đầu: ${evt.title}`,
                `Đã đến giờ bắt đầu lịch trình của bạn${evt.description ? ': ' + evt.description : ''}. Hãy thực hiện ngay!`
            );
            evt.notified = true;
            changed = true;
        }

        if (diff <= 0) {
            // Chưa đến giờ – không làm gì
            return;
        }

        if (diff > SIX_HOURS) {
            // Quá 6h từ giờ hẹn → Thất bại
            if (evt.status !== 'fail') {
                evt.status = 'fail';
                changed = true;
            }
        } else if (diff > THREE_HOURS) {
            // Quá 3h → gửi Desktop Notification nếu chưa gửi
            if (!evt.notified) {
                sendDesktopNotification(
                    '⏰ Nhắc nhở lịch trình',
                    `"${evt.title}" đã quá giờ hơn 3 tiếng mà chưa hoàn thành!`
                );
                evt.notified = true;
                changed = true;
            }
            // Đổi sang warn nếu chưa fail
            if (evt.status !== 'warn' && evt.status !== 'fail') {
                evt.status = 'warn';
                changed = true;
            }
        } else {
            // Quá giờ nhưng chưa đến 3h → Warning
            if (evt.status !== 'warn' && evt.status !== 'fail') {
                evt.status = 'warn';
                changed = true;
            }
        }
    });

    if (changed) {
        saveAllEvents(events);
        // Reload calendar để hiển thị cập nhật
        loadCalendar();
        // Nếu Day Detail Popup đang mở → refresh
        if (currentDayDetailDate) {
            renderDayDetailBody(currentDayDetailDate);
        }
    }
}

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('dayDetailModal').style.display !== 'none') {
            closeDayDetail();
        } else {
            closeModal();
        }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') changeMonth(-1);
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') changeMonth(1);
});

// =============================================
// KHỞI TẠO
// =============================================
requestNotificationPermission();
initTimePickers(); // Populate custom time picker dropdowns
loadCalendar();
checkTaskStatuses(); // Kiểm tra ngay lúc load

// Vòng lặp kiểm tra mỗi 60 giây
setInterval(checkTaskStatuses, 60 * 1000);
