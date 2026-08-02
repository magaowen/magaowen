/* =====================================================
 * SoftHub 数据层
 * 真实后端模式(remote)：Cloudflare KV + Functions，全站共享数据
 * 本地兜底模式(local)：localStorage（KV 未绑定/离线时自动回退）
 * 读取走内存缓存(同步)，写入更新缓存并后台同步到 API
 * ===================================================== */
const DB = {
  prefix: 'sh_',
  mode: 'local',
  cache: null,
  /* 缓存版本号：每次需要废弃旧缓存时 +1，用户浏览器 localStorage 里的
     过期数据（如演示软件/残留假数据）会被自动清除，不会闪现。 */
  CACHE_VERSION: 3,
  /* ---------- 异步启动：拉取真实数据，失败回退本地 ----------
   * 单飞（in-flight 复用）：页面里可能有多处调用 DB.init()，
   * 若不去重会重复请求 /api/bootstrap，首屏直接慢一倍。 */
  init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  },
  /* 强制重新拉取（如重置数据后） */
  reinit() { this._initPromise = null; return this.init(); },
  async _doInit() {
    this.seedLocal();                 // 确保本地有基线（兜底用）
    this._migrateCache();             // 版本不匹配则清掉易变数据的旧缓存
    this.cache = this.loadLocal();   // 先以本地数据为基线
    this.mode = 'local';
    try {
      const data = await this.api('/api/bootstrap', 'GET');
      if (data && data.mode === 'remote') {
        this.mode = 'remote';
        this.cache = {
          users: data.users || [],
          softwares: data.softwares || [],
          comments: data.comments || [],
          logs: data.logs || [],
          categories: data.categories || [],
          announcements: data.announcements || [],
          settings: data.settings || {},
          session: data.me || null,
        };
        /* 远程成功后标记缓存版本，下次直接用本地缓存秒开 */
        this.write('cacheVersion', this.CACHE_VERSION);
      }
    } catch (e) { /* 网络/构建未完成，保持本地模式 */ }
    return this;
  },
  /* 缓存迁移：版本号不匹配时清除易变集合（softwares/comments/logs），
     防止旧版演示数据/残留假数据在「缓存秒开」时闪现。
     结构性数据（categories/settings/users/announcements）保留不变。 */
  _migrateCache() {
    var stored = this.read('cacheVersion', 0);
    if (stored === this.CACHE_VERSION) return;  // 版本一致，无需清理
    console.log('[DB] cache migration: v' + stored + ' -> v' + this.CACHE_VERSION + ', clearing volatile caches');
    ['softwares', 'comments', 'logs'].forEach(function(k) {
      localStorage.removeItem('sh_' + k);
    });
    this.write('cacheVersion', this.CACHE_VERSION);
  },
  async api(path, method = 'GET', body) {
    try {
      const opt = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
      if (body !== undefined) opt.body = JSON.stringify(body);
      const r = await fetch(path, opt);
      if (r.status === 204) return { ok: true };
      const data = await r.json().catch(() => null);
      if (!r.ok) return data || { error: '请求失败(' + r.status + ')' };
      return data;
    } catch (e) { return null; }
  },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },

  /* ---------- 本地存储（兜底基线） ---------- */
  read(key, def) {
    try { const raw = localStorage.getItem(this.prefix + key); return raw === null ? def : JSON.parse(raw); }
    catch (e) { return def; }
  },
  write(key, val) { localStorage.setItem(this.prefix + key, JSON.stringify(val)); },
  /* 仅写入结构基线（分类/设置/公告/管理员账户），不注入任何演示软件/评论/日志。
     首次访问后 inited=true 不再重复执行；真实数据由远程 bootstrap 提供。 */
  seedLocal() {
    if (this.read('inited', false)) return;
    const now = Date.now();
    const categories = [
      { id: 'dev', name: '开发工具', icon: '⌨️' }, { id: 'office', name: '效率办公', icon: '📊' },
      { id: 'media', name: '影音媒体', icon: '🎬' }, { id: 'system', name: '系统工具', icon: '🛠️' },
      { id: 'secure', name: '网络安全', icon: '🛡️' }, { id: 'design', name: '图形设计', icon: '🎨' },
      { id: 'game', name: '游戏娱乐', icon: '🎮' }, { id: 'ai', name: 'AI 工具', icon: '🤖' },
    ];
    const users = [
      { id: 'u_admin', username: 'admin', password: 'admin123', email: 'admin@softhub.io', role: 'admin', status: 'active', createdAt: now, lastLogin: now, color: '#6366f1' },
    ];
    const settings = {
      siteName: 'SoftHub',
      siteSlogan: '发现 · 分享 · 极致软件体验',
      heroTitle: '发现下一款改变工作方式的软件',
      requireReview: true, allowRegister: true, allowComment: true, maxUploadMB: 2048, maintenance: false,
      business: {
        enabled: true, title: '🤝 商务合作',
        desc: '欢迎软件厂商、开发者与渠道伙伴与我们洽谈上架、赞助与联合推广等合作。',
        contacts: [
          { label: '商务邮箱', value: 'business@softhub.io', icon: '📧' },
          { label: '微信号', value: 'SoftHub-Biz', icon: '💬' },
          { label: '合作 QQ', value: '800000001', icon: '🐧' },
        ],
        images: [],
      },
      animations: { cardIn: true, spinner: true, hover: true, modal: true },
    };
    const announcements = [
      { id: 'a_1', title: '🎉 SoftHub 全新改版上线', content: '全新科技感界面、明暗模式自动切换，欢迎体验并反馈建议！', enabled: true, createdAt: now },
    ];
    this.write('categories', categories);
    this.write('users', users);
    this.write('softwares', []);
    this.write('comments', []);
    this.write('logs', []);
    this.write('announcements', announcements);
    this.write('settings', settings);
    this.write('inited', true);
  },
  loadLocal() {
    const users = this.read('users', []);
    const sid = this.read('session', null);
    return {
      users, softwares: this.read('softwares', []), comments: this.read('comments', []),
      logs: this.read('logs', []), categories: this.read('categories', []), announcements: this.read('announcements', []),
      settings: this.read('settings', {}), session: sid ? users.find(u => u.id === sid) || null : null,
    };
  },

  /* ---------- 同步读取（走缓存） ---------- */
  users() { return this.cache.users || []; },
  softwares() { return this.cache.softwares || []; },
  comments() { return this.cache.comments || []; },
  logs() { return this.cache.logs || []; },
  categories() { return this.cache.categories || []; },
  announcements() { return this.cache.announcements || []; },
  settings() { return this.cache.settings || {}; },
  userById(id) { return this.cache.users.find(u => u.id === id); },
  softwareById(id) { return this.cache.softwares.find(s => s.id === id); },
  categoryById(id) { return this.cache.categories.find(c => c.id === id); },
  session() { return this.cache.session || null; },

  /* ---------- 同步写入（更新缓存 + 后台同步 API / 本地） ---------- */
  saveUsers(v) { this.cache.users = v; this._sync('users', v); },
  saveSoftwares(v) { this.cache.softwares = v; this._sync('softwares', v); },
  saveComments(v) { this.cache.comments = v; this._sync('comments', v); },
  saveLogs(v) { this.cache.logs = v; this._sync('logs', v); },
  saveCategories(v) { this.cache.categories = v; this._sync('categories', v); },
  saveAnnouncements(v) { this.cache.announcements = v; this._sync('announcements', v); },
  saveSettings(v) { this.cache.settings = v; this._sync('settings', v); },
  _sync(key, val) {
    if (this.mode === 'local') { this.write(key, val); return; }
    /* 后台同步到 API：不 await，失败不影响本地缓存 */
    this.api('/api/collections/' + key, 'PUT', val).catch(e => {
      console.warn('[DB] 后台同步失败 (' + key + '):', e && e.message);
    });
  },

  /* ---------- 会话（鉴权走 API） ---------- */
  async login(username, password) {
    if (this.mode === 'remote') {
      const r = await this.api('/api/auth/login', 'POST', { username, password });
      if (!r || r.error) { if (r && r.error) U.toast(r.error, 'err'); return null; }
      this.cache.session = r.me; return r.me;
    }
    const u = this.cache.users.find(x => x.username === username && x.password === password);
    if (!u) return null;
    this.cache.session = u; this.write('session', u.id); return u;
  },
  async register(data) {
    if (this.mode === 'remote') {
      const r = await this.api('/api/auth/register', 'POST', data);
      if (!r || r.error) { if (r && r.error) U.toast(r.error, 'err'); return null; }
      this.cache.session = r.me; return r.me;
    }
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const nu = { id: 'u_' + this.uid(), username: data.username, password: data.password, email: data.email, role: 'user', status: 'active', createdAt: Date.now(), lastLogin: Date.now(), color: colors[Math.floor(Math.random() * colors.length)] };
    this.cache.users.push(nu); this.saveUsers(this.cache.users);
    this.cache.session = nu; this.write('session', nu.id); return nu;
  },
  logout() {
    this.cache.session = null; this.write('session', null);
    if (this.mode === 'remote') this.api('/api/auth/logout', 'POST');
  },

  /* ---------- 重置（远程走 API，本地清种） ---------- */
  async reset() {
    if (this.mode === 'remote') { const r = await this.api('/api/reset', 'POST'); if (r && r.ok) await this.reinit(); return; }
    Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k));
    this.seedLocal(); this.cache = this.loadLocal();
  },
};

/* =====================================================
 * 通用工具
 * ===================================================== */
const U = {
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); },
  fmtSize(mb) { mb = +mb || 0; if (mb <= 0) return '未知'; if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'; return (mb % 1 === 0 ? mb : mb.toFixed(1)) + ' MB'; },
  fmtNum(n) { if (n >= 10000) return (n / 10000).toFixed(1) + 'w'; if (n >= 1000) return (n / 1000).toFixed(1) + 'k'; return String(n); },
  fmtDate(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
  fmtTime(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  ago(t) { const s = (Date.now() - t) / 1000; if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + ' 分钟前'; if (s < 86400) return Math.floor(s / 3600) + ' 小时前'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前'; return this.fmtDate(t); },
  stars(r) { const full = Math.round(r); let h = ''; for (let i = 1; i <= 5; i++) h += `<span class="star ${i <= full ? 'on' : ''}">★</span>`; return h; },
  toast(msg, type = 'info') {
    let box = document.getElementById('toastBox');
    if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
    const el = document.createElement('div'); el.className = 'toast toast-' + type;
    el.innerHTML = `<span>${type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ'}</span>${U.esc(msg)}`;
    box.appendChild(el); setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
  },
  confirmBox(msg, onOk, onCancel) { U.confirm(msg, onOk, onCancel); },
  confirm(msg, onOk, onCancel) {
    const box = document.createElement('div'); box.className = 'modal-mask';
    box.innerHTML = `<div class="modal" style="max-width:430px"><div class="modal-confirm-body">${U.esc(msg)}</div><div class="modal-confirm-actions"><button class="btn" id="uiCancel">取消</button><button class="btn btn-primary" id="uiOk">确定</button></div></div>`;
    document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('open'));
    box.querySelector('#uiCancel').onclick = () => { box.remove(); onCancel && onCancel(); };
    box.querySelector('#uiOk').onclick = () => { box.remove(); onOk && onOk(); };
    box.onclick = e => { if (e.target === box) { box.remove(); onCancel && onCancel(); } };
  },
  prompt(msg, onOk, def) {
    const box = document.createElement('div'); box.className = 'modal-mask';
    box.innerHTML = `<div class="modal" style="max-width:440px"><div class="modal-confirm-body" style="margin-bottom:10px">${U.esc(msg)}</div><input id="uiPromptVal" value="${U.esc(def || '')}" style="width:100%"><div class="modal-confirm-actions" style="margin-top:16px"><button class="btn" id="uiCancel">取消</button><button class="btn btn-primary" id="uiOk">确定</button></div></div>`;
    document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('open'));
    const input = box.querySelector('#uiPromptVal'); input.focus(); input.select();
    const done = () => { const v = input.value; box.remove(); onOk && onOk(v); };
    box.querySelector('#uiCancel').onclick = () => box.remove();
    box.querySelector('#uiOk').onclick = done; input.onkeydown = e => { if (e.key === 'Enter') done(); };
    box.onclick = e => { if (e.target === box) box.remove(); };
  },
  /* 压缩上传的图片文件。默认 720px / 0.72 —— 原先 900/0.82 会产出 300KB+ 的
   * base64，几张图就把列表接口撑到 500KB，首屏直接卡数秒。 */
  compressImage(file, maxDim = 720, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.resizeDataUrl(reader.result, maxDim, quality).then(resolve).catch(() => resolve(reader.result));
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  },
  /* 从已有 dataURL 再缩放一次（用于生成缩略图 / 迁移老数据） */
  resizeDataUrl(dataUrl, maxDim = 720, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!dataUrl || dataUrl.indexOf('data:image') !== 0) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale); height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => reject(new Error('图片解析失败'));
      img.src = dataUrl;
    });
  },
  /* 列表卡片用的小缩略图：360px / 0.6，通常 12-25KB */
  makeThumb(dataUrl, maxDim = 360, quality = 0.6) {
    return this.resizeDataUrl(dataUrl, maxDim, quality).catch(() => '');
  },
  /* 从 state（含 images/coverId）里挑出封面并生成缩略图 */
  thumbFromState(st) {
    const imgs = (st && st.images) || [];
    if (!imgs.length) return Promise.resolve('');
    const cover = imgs.find(i => i.id === st.coverId) || imgs[0];
    if (!cover || !cover.data) return Promise.resolve('');
    return this.makeThumb(cover.data);
  },
  /* 列表用封面：优先小缩略图（列表接口不再返回原图 images） */
  coverOf(s) { if (!s) return null; const imgs = s.images || []; const cover = imgs.find(i => i.id === s.coverId) || imgs[0]; if (cover && cover.data) return cover.data; return s.thumb || null; },
  /* 带真实上传进度（XMLHttpRequest.upload.onprogress）的 POST，返回解析后的 JSON */
  xhrPost(url, body, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.error) || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = () => reject(new Error('网络错误，请求失败'));
      xhr.send(JSON.stringify(body || {}));
    });
  },
  xhrPut(url, body) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => {
        let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.error) || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = () => reject(new Error('网络错误，请求失败'));
      xhr.send(JSON.stringify(body || {}));
    });
  },
  /* GET 请求（用于按需拉取完整数据等场景），返回解析后的 JSON */
  xhrGet(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.withCredentials = true;
      xhr.onload = () => {
        let data = null; try { data = JSON.parse(xhr.responseText); } catch (_) { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.error) || ('HTTP ' + xhr.status)));
      };
      xhr.onerror = () => reject(new Error('网络错误'));
      xhr.send();
    });
  },
  downloadSoftFile(s) {
    if (s.link && !s.fileData) { window.open(s.link, '_blank', 'noopener'); return; }
    const fileName = s.fileName || (s.name + '-v' + s.version + '.bin');
    if (s.fileData) {
      /* base64 data URI → Blob → 真实文件下载 */
      try {
        const parts = s.fileData.split(',');
        const mime = parts[0].match(/data:([^;]*)/)?.[1] || 'application/octet-stream';
        const bstr = atob(parts[1]);
        const buf = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) buf[i] = bstr.charCodeAt(i);
        const blob = new Blob([buf], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      } catch (e) {
        console.warn('Base64 decode failed, fallback to direct open:', e);
      }
    }
    /* 兜底：生成占位文本 */
    const blob = new Blob([`SoftHub 演示下载\n=================\n软件：${s.name} v${s.version}\n大小：${U.fmtSize(s.size)}\n说明：演示环境未存储真实安装包，此文件为占位下载。`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${s.name}-v${s.version}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
  },
  renderImageUploader(mountId, state, obj, ns) {
    const box = document.getElementById(mountId); if (!box) return;
    const imgs = state.images || [];
    let html = `<div class="img-uploader"><div class="img-add" id="${mountId}_add"><span style="font-size:26px">🖼️</span><span>点击或拖拽上传图片（可多张）</span></div><input type="file" id="${mountId}_file" accept="image/*" multiple style="display:none">`;
    if (imgs.length) {
      html += `<div class="img-grid">` + imgs.map(im => `<div class="img-item ${im.id === state.coverId ? 'cover' : ''}"><img src="${im.data}" alt=""><span class="img-cover-badge">首图</span><div class="img-actions"><button class="img-set-cover" title="设为首图" onclick="${ns}.setCover('${im.id}')">★</button><button class="img-remove" title="删除" onclick="${ns}.removeImage('${im.id}')">✕</button></div></div>`).join('') + `</div>`;
    }
    html += `</div>`; box.innerHTML = html;
    const add = document.getElementById(mountId + '_add'); const input = document.getElementById(mountId + '_file');
    add.onclick = () => input.click();
    input.onchange = () => { obj.addImageFiles(input.files); input.value = ''; };
    add.ondragover = e => { e.preventDefault(); add.classList.add('drag'); };
    add.ondragleave = () => add.classList.remove('drag');
    add.ondrop = e => { e.preventDefault(); add.classList.remove('drag'); if (e.dataTransfer.files[0]) obj.addImageFiles(e.dataTransfer.files); };
  },
  /* 按站点设置里的 animations 开关，在 body 上挂/卸动画 class（前台后台都调用） */
  applyAnim() {
    const st = (typeof DB !== 'undefined' && DB.settings) ? DB.settings() : {};
    const a = st.animations || { cardIn: true, spinner: true, hover: true, modalPop: true };
    const b = document.body.classList;
    b.toggle('a-cardIn', !!a.cardIn);
    b.toggle('a-spinner', !!a.spinner);
    b.toggle('a-hover', !!a.hover);
    b.toggle('a-modal', !!a.modalPop);
  },
  /* 加载/等待动画（受 a-spinner 控制）：true 显示覆盖层，false 隐藏 */
  loading(on) {
    if (on && !document.body.classList.contains('a-spinner')) return;
    let el = document.getElementById('loadingOverlay');
    if (on) {
      if (!el) {
        el = document.createElement('div'); el.id = 'loadingOverlay';
        el.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(el);
      }
      requestAnimationFrame(() => el.classList.add('show'));
    } else if (el) {
      el.classList.remove('show');
    }
  },
};

/* 生成渐变封面图（本地兜底种子用） */
function coverSVG(name, c1, c2) {
  const safe = String(name || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='600' height='400' fill='url(#g)'/><circle cx='500' cy='80' r='120' fill='rgba(255,255,255,.12)'/><circle cx='90' cy='340' r='90' fill='rgba(255,255,255,.10)'/><text x='50%' y='54%' font-size='52' fill='rgba(255,255,255,.95)' text-anchor='middle' font-family='sans-serif' font-weight='800'>${safe}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* =====================================================
 * 主题管理
 * ===================================================== */
const Theme = {
  get() { return localStorage.getItem('sh_theme_mode') || 'auto'; },
  set(mode) { localStorage.setItem('sh_theme_mode', mode); this.apply(); },
  apply() {
    const mode = this.get(); let dark = mode === 'dark';
    if (mode === 'auto') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-btn').forEach(btn => { btn.textContent = mode === 'auto' ? '🌗' : (mode === 'dark' ? '🌙' : '☀️'); btn.title = '主题模式：' + (mode === 'auto' ? '跟随系统' : mode === 'dark' ? '深色' : '浅色') + '（点击切换）'; });
  },
  cycle() { const order = ['auto', 'light', 'dark']; const next = order[(order.indexOf(this.get()) + 1) % 3]; this.set(next); U.toast('主题已切换为：' + (next === 'auto' ? '跟随系统 🌗' : next === 'dark' ? '深色 🌙' : '浅色 ☀️')); },
  init() {
    this.apply();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (this.get() === 'auto') this.apply(); });
  },
};

Theme.init();
