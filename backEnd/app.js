/* ===================================================
   LinkVault — App Logic
   Storage: localStorage  |  No external dependencies
   =================================================== */

// ── Utilities ────────────────────────────────────────
const uid = () => crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const domainOf = url => {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return url; }
};

const faviconUrl = url => {
    try {
        const h = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${h}&sz=64`;
    } catch { return ''; }
};

const relativeTime = isoStr => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d} ngày trước`;
    return new Date(isoStr).toLocaleDateString('vi-VN');
};

// ── State ─────────────────────────────────────────────
const STORAGE_KEY = 'linkvault_data';

let state = {
    webs: [],           // [{id, name, color, topics:[{id, name, links:[{id,url,title,favicon,savedAt}]}]}]
    selectedWebId: null,
    selectedTopicId: null,
    viewMode: 'grid',   // 'grid' | 'list'
    searchQuery: '',
    pendingDelete: null // { type:'web'|'topic'|'link', webId, topicId, linkId }
};

// ── Persistence ───────────────────────────────────────
const load = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state.webs = JSON.parse(raw);
    } catch { state.webs = []; }
};

const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.webs)); }
    catch (e) { showToast('Lỗi khi lưu dữ liệu', 'error'); }
};

// ── Selectors ─────────────────────────────────────────
const getWeb = id => state.webs.find(w => w.id === id);
const getTopic = (webId, topicId) => getWeb(webId)?.topics?.find(t => t.id === topicId);

const getCurrentLinks = () => {
    if (state.selectedTopicId && state.selectedWebId) {
        return getTopic(state.selectedWebId, state.selectedTopicId)?.links ?? [];
    }
    if (state.selectedWebId) {
        const web = getWeb(state.selectedWebId);
        return web?.topics?.flatMap(t => t.links) ?? [];
    }
    // All webs
    return state.webs.flatMap(w => w.topics?.flatMap(t => t.links) ?? []);
};

// ── Toast ─────────────────────────────────────────────
let toastTimer;
const showToast = (msg, type = 'success') => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
};

// ── Modal helpers ─────────────────────────────────────
const openModal = id => document.getElementById(id)?.classList.add('open');
const closeModal = id => document.getElementById(id)?.classList.remove('open');

// ── Render: Sidebar Webs ──────────────────────────────
const renderWebs = () => {
    const list = document.getElementById('webList');
    list.innerHTML = '';

    state.webs.forEach(web => {
        const totalLinks = web.topics?.reduce((n, t) => n + t.links.length, 0) ?? 0;
        const li = document.createElement('div');
        li.className = 'web-item' + (web.id === state.selectedWebId ? ' active' : '');
        li.dataset.id = web.id;
        li.innerHTML = `
      <span class="web-dot" style="background:${web.color}"></span>
      <span class="web-name" title="${escHtml(web.name)}">${escHtml(web.name)}</span>
      <span class="web-count">${totalLinks}</span>
      <button class="web-del btn-icon" title="Xoá Web" data-id="${web.id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>`;
        li.addEventListener('click', e => {
            if (e.target.closest('.web-del')) return;
            selectWeb(web.id);
        });
        li.querySelector('.web-del').addEventListener('click', e => {
            e.stopPropagation();
            confirmDelete('web', web.id);
        });
        list.appendChild(li);
    });
};

// ── Render: Sidebar Topics ────────────────────────────
const renderTopics = () => {
    const section = document.getElementById('topicSection');
    const list = document.getElementById('topicList');
    const web = getWeb(state.selectedWebId);

    if (!web) { section.style.display = 'none'; return; }
    section.style.display = '';
    list.innerHTML = '';

    web.topics?.forEach(topic => {
        const li = document.createElement('div');
        li.className = 'topic-item' + (topic.id === state.selectedTopicId ? ' active' : '');
        li.dataset.id = topic.id;
        li.innerHTML = `
      <svg class="topic-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="topic-name" title="${escHtml(topic.name)}">${escHtml(topic.name)}</span>
      <span class="topic-count">${topic.links.length}</span>
      <button class="topic-del btn-icon" title="Xoá Topic" data-id="${topic.id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>`;
        li.addEventListener('click', e => {
            if (e.target.closest('.topic-del')) return;
            selectTopic(topic.id);
        });
        li.querySelector('.topic-del').addEventListener('click', e => {
            e.stopPropagation();
            confirmDelete('topic', state.selectedWebId, topic.id);
        });
        list.appendChild(li);
    });
};

// ── Render: Breadcrumb ────────────────────────────────
const renderBreadcrumb = () => {
    const bc = document.getElementById('breadcrumb');
    const web = getWeb(state.selectedWebId);
    const topic = web && state.selectedTopicId
        ? getTopic(state.selectedWebId, state.selectedTopicId)
        : null;

    if (!web) {
        bc.innerHTML = '<span class="bc-item bc-home">Tất cả</span>';
        return;
    }
    let html = `<span class="bc-item bc-home bc-web" id="bcWebClick">${escHtml(web.name)}</span>`;
    if (topic) {
        html += `<span class="bc-sep bc-item">›</span>
             <span class="bc-item bc-topic">${escHtml(topic.name)}</span>`;
    }
    bc.innerHTML = html;
    document.getElementById('bcWebClick')?.addEventListener('click', () => {
        state.selectedTopicId = null;
        renderAll();
    });
};

// ── Render: Links ─────────────────────────────────────
const renderLinks = () => {
    const grid = document.getElementById('linksGrid');
    const empty = document.getElementById('emptyState');
    const countEl = document.getElementById('linkCount');

    let links = getCurrentLinks();

    // Apply search
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
        links = links.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.url.toLowerCase().includes(q)
        );
    }

    countEl.textContent = `${links.length} link`;

    // Grid vs list
    grid.className = 'links-grid' + (state.viewMode === 'list' ? ' list-view' : '');

    if (links.length === 0) {
        empty.style.display = '';
        grid.innerHTML = '';
        return;
    }
    empty.style.display = 'none';

    // Find web color for each link (if showing all)
    const linkToWebColor = {};
    const linkToWebName = {};
    const linkToTopicName = {};
    state.webs.forEach(w => {
        w.topics?.forEach(t => {
            t.links.forEach(l => {
                linkToWebColor[l.id] = w.color;
                linkToWebName[l.id] = w.name;
                linkToTopicName[l.id] = t.name;
            });
        });
    });

    const showWebTag = !state.selectedWebId;
    const showTopicTag = state.selectedWebId && !state.selectedTopicId;

    grid.innerHTML = links.map(link => {
        const color = linkToWebColor[link.id] || 'var(--accent)';
        const webTagHtml = showWebTag
            ? `<span class="card-tag web-tag" style="border-color:${color}30;color:${color}">${escHtml(linkToWebName[link.id] || '')}</span>`
            : '';
        const topicTagHtml = showTopicTag
            ? `<span class="card-tag">${escHtml(linkToTopicName[link.id] || '')}</span>`
            : '';

        return `
      <a class="link-card" href="${escHtml(link.url)}" target="_blank" rel="noopener noreferrer" data-lid="${link.id}">
        <div class="card-header">
          <img class="card-favicon" src="${link.favicon}" alt="" loading="lazy"
               onerror="this.style.display='none'">
          <span class="card-domain">${escHtml(domainOf(link.url))}</span>
          <svg class="card-open-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
        <div class="card-title">${escHtml(link.title)}</div>
        <div class="card-footer">
          <div class="card-meta">
            ${webTagHtml}${topicTagHtml}
            <span class="card-date">${relativeTime(link.savedAt)}</span>
          </div>
          <button class="card-del" title="Xoá link" data-lid="${link.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        </div>
      </a>`;
    }).join('');

    // Delete link buttons
    grid.querySelectorAll('.card-del').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            confirmDelete('link', null, null, btn.dataset.lid);
        });
    });
};

// ── Render: Quick Add Selects ─────────────────────────
const renderSelects = () => {
    const webSel = document.getElementById('webSelect');
    const topicSel = document.getElementById('topicSelect');
    const prevWebId = webSel.value;

    // Web select
    webSel.innerHTML = '<option value="">— Chọn Web —</option>' +
        state.webs.map(w => `<option value="${w.id}"${w.id === prevWebId ? ' selected' : ''}>${escHtml(w.name)}</option>`).join('');

    // If there's an active web, pre-select it
    if (state.selectedWebId && !prevWebId) webSel.value = state.selectedWebId;

    updateTopicSelect();
};

const updateTopicSelect = () => {
    const webSel = document.getElementById('webSelect');
    const topicSel = document.getElementById('topicSelect');
    const wid = webSel.value;
    const web = getWeb(wid);

    topicSel.innerHTML = '<option value="">— Chọn Topic —</option>' +
        (web?.topics ?? []).map(t =>
            `<option value="${t.id}"${t.id === state.selectedTopicId ? ' selected' : ''}>${escHtml(t.name)}</option>`
        ).join('');
};

// ── Render: All ───────────────────────────────────────
const renderAll = () => {
    renderWebs();
    renderTopics();
    renderBreadcrumb();
    renderLinks();
    renderSelects();
};

// ── Navigation ────────────────────────────────────────
const selectWeb = id => {
    state.selectedWebId = id;
    state.selectedTopicId = null;
    state.searchQuery = '';
    document.getElementById('searchInput').value = '';
    renderAll();
};

const selectTopic = id => {
    state.selectedTopicId = id;
    state.searchQuery = '';
    document.getElementById('searchInput').value = '';
    renderAll();
};

// ── Actions: Add Web ──────────────────────────────────
let selectedWebColor = '#6366f1';

const initAddWebModal = () => {
    document.getElementById('webNameInput').value = '';
    selectedWebColor = '#6366f1';
    document.querySelectorAll('#webColorPicker .swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === selectedWebColor);
    });
};

const addWeb = () => {
    const nameInput = document.getElementById('webNameInput');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); showToast('Vui lòng nhập tên Web', 'error'); return; }

    const web = { id: uid(), name, color: selectedWebColor, topics: [] };
    state.webs.push(web);
    save();
    closeModal('addWebModal');
    selectWeb(web.id);
    showToast(`Đã tạo Web "${name}"`);
};

// ── Actions: Add Topic ────────────────────────────────
const addTopic = () => {
    const nameInput = document.getElementById('topicNameInput');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); showToast('Vui lòng nhập tên Topic', 'error'); return; }

    const web = getWeb(state.selectedWebId);
    if (!web) { showToast('Vui lòng chọn một Web trước', 'error'); closeModal('addTopicModal'); return; }

    const topic = { id: uid(), name, links: [] };
    web.topics.push(topic);
    save();
    closeModal('addTopicModal');
    renderAll();
    showToast(`Đã tạo Topic "${name}"`);
};

// ── Actions: Save Link ────────────────────────────────
const saveLink = () => {
    const rawUrl = document.getElementById('urlInput').value.trim();
    const webId = document.getElementById('webSelect').value;
    const topicId = document.getElementById('topicSelect').value;

    if (!rawUrl) {
        document.getElementById('urlInput').focus();
        showToast('Vui lòng dán URL cần lưu', 'error'); return;
    }

    let url = rawUrl;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    try { new URL(url); } catch {
        showToast('URL không hợp lệ', 'error'); return;
    }
    if (!webId) { showToast('Vui lòng chọn Web', 'error'); return; }
    if (!topicId) { showToast('Vui lòng chọn Topic', 'error'); return; }

    const topic = getTopic(webId, topicId);
    if (!topic) { showToast('Topic không tồn tại', 'error'); return; }

    // Duplicate check
    if (topic.links.some(l => l.url === url)) {
        showToast('Link này đã được lưu trong Topic', 'error'); return;
    }

    const domain = domainOf(url);
    const link = {
        id: uid(),
        url,
        title: domain,          // default title = domain
        favicon: faviconUrl(url),
        savedAt: new Date().toISOString()
    };

    topic.links.unshift(link);
    save();
    document.getElementById('urlInput').value = '';
    renderAll();
    showToast('Đã lưu link!');

    // Try to fetch a better title via a CORS-friendly approach
    fetchTitle(url, link, webId, topicId);
};

// ── Fetch Title ───────────────────────────────────────
const fetchTitle = async (url, linkObj, webId, topicId) => {
    try {
        // Use a public CORS proxy / metadata service
        const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return;
        const data = await res.json();
        const title = data.title?.trim();
        if (!title) return;

        const topic = getTopic(webId, topicId);
        const link = topic?.links?.find(l => l.id === linkObj.id);
        if (!link) return;
        link.title = title;
        if (data.favicon) link.favicon = data.favicon;
        save();
        renderLinks();
    } catch { /* silent */ }
};

// ── Actions: Delete ───────────────────────────────────
const confirmDelete = (type, webId, topicId, linkId) => {
    const titleEl = document.getElementById('deleteModalTitle');
    const msgEl = document.getElementById('deleteModalMsg');

    if (type === 'web') {
        const web = getWeb(webId);
        const count = web?.topics?.reduce((n, t) => n + t.links.length, 0) ?? 0;
        titleEl.textContent = 'Xoá Web';
        msgEl.textContent = `Bạn chắc muốn xoá Web "${web?.name}"? Toàn bộ ${count} link bên trong sẽ bị xoá vĩnh viễn.`;
        state.pendingDelete = { type, webId };
    } else if (type === 'topic') {
        const topic = getTopic(webId, topicId);
        titleEl.textContent = 'Xoá Topic';
        msgEl.textContent = `Bạn chắc muốn xoá Topic "${topic?.name}"? ${topic?.links?.length ?? 0} link bên trong sẽ bị xoá.`;
        state.pendingDelete = { type, webId, topicId };
    } else if (type === 'link') {
        // Find the link across all topics
        let foundLink, foundWebId, foundTopicId;
        outer: for (const w of state.webs) {
            for (const t of w.topics ?? []) {
                const l = t.links.find(x => x.id === linkId);
                if (l) { foundLink = l; foundWebId = w.id; foundTopicId = t.id; break outer; }
            }
        }
        titleEl.textContent = 'Xoá link';
        msgEl.textContent = `Xoá link "${foundLink?.title || foundLink?.url}"?`;
        state.pendingDelete = { type, webId: foundWebId, topicId: foundTopicId, linkId };
    }
    openModal('deleteModal');
};

const executeDelete = () => {
    const p = state.pendingDelete;
    if (!p) return;

    if (p.type === 'web') {
        state.webs = state.webs.filter(w => w.id !== p.webId);
        if (state.selectedWebId === p.webId) {
            state.selectedWebId = null;
            state.selectedTopicId = null;
        }
        showToast('Đã xoá Web');
    } else if (p.type === 'topic') {
        const web = getWeb(p.webId);
        if (web) web.topics = web.topics.filter(t => t.id !== p.topicId);
        if (state.selectedTopicId === p.topicId) state.selectedTopicId = null;
        showToast('Đã xoá Topic');
    } else if (p.type === 'link') {
        const topic = getTopic(p.webId, p.topicId);
        if (topic) topic.links = topic.links.filter(l => l.id !== p.linkId);
        showToast('Đã xoá link');
    }

    state.pendingDelete = null;
    save();
    closeModal('deleteModal');
    renderAll();
};

// ── Export ────────────────────────────────────────────
const exportData = () => {
    const json = JSON.stringify(state.webs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkvault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất dữ liệu');
};

// ── Escape HTML ───────────────────────────────────────
const escHtml = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ── Event Listeners ───────────────────────────────────
const initEvents = () => {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('mobileMenu')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Add Web
    document.getElementById('addWebBtn').addEventListener('click', () => {
        initAddWebModal();
        openModal('addWebModal');
        setTimeout(() => document.getElementById('webNameInput').focus(), 100);
    });
    document.getElementById('confirmAddWeb').addEventListener('click', addWeb);
    document.getElementById('webNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addWeb();
    });
    document.querySelectorAll('#webColorPicker .swatch').forEach(s => {
        s.addEventListener('click', () => {
            document.querySelectorAll('#webColorPicker .swatch').forEach(x => x.classList.remove('active'));
            s.classList.add('active');
            selectedWebColor = s.dataset.color;
        });
    });

    // Add Topic
    document.getElementById('addTopicBtn').addEventListener('click', () => {
        if (!state.selectedWebId) { showToast('Vui lòng chọn Web trước', 'error'); return; }
        document.getElementById('topicNameInput').value = '';
        openModal('addTopicModal');
        setTimeout(() => document.getElementById('topicNameInput').focus(), 100);
    });
    document.getElementById('confirmAddTopic').addEventListener('click', addTopic);
    document.getElementById('topicNameInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addTopic();
    });

    // Close modals
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
        }
    });

    // Save link
    document.getElementById('saveBtn').addEventListener('click', saveLink);
    document.getElementById('urlInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') saveLink();
    });

    // Web select change → update topic select
    document.getElementById('webSelect').addEventListener('change', updateTopicSelect);

    // Paste URL → auto-focus
    document.addEventListener('paste', e => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        const text = e.clipboardData?.getData('text') ?? '';
        if (/^https?:\/\//i.test(text)) {
            e.preventDefault();
            const input = document.getElementById('urlInput');
            input.value = text;
            input.focus();
        }
    });

    // Delete confirm
    document.getElementById('confirmDelete').addEventListener('click', executeDelete);

    // Search
    document.getElementById('searchInput').addEventListener('input', e => {
        state.searchQuery = e.target.value;
        renderLinks();
    });

    // View toggle
    document.getElementById('gridViewBtn').addEventListener('click', () => {
        state.viewMode = 'grid';
        document.getElementById('gridViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
        renderLinks();
    });
    document.getElementById('listViewBtn').addEventListener('click', () => {
        state.viewMode = 'list';
        document.getElementById('listViewBtn').classList.add('active');
        document.getElementById('gridViewBtn').classList.remove('active');
        renderLinks();
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', exportData);
};

// ── Bootstrap ─────────────────────────────────────────
const init = () => {
    load();
    initEvents();
    renderAll();
};

document.addEventListener('DOMContentLoaded', init);
