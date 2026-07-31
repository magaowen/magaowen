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
  /* ---------- 异步启动：拉取真实数据，失败回退本地 ---------- */
  async init() {
    this.seedLocal();                 // 确保本地有基线（兜底用）
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
      }
    } catch (e) { /* 网络/构建未完成，保持本地模式 */ }
    return this;
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
  seedLocal() {
    if (this.read('inited', false)) return;
    const now = Date.now(), day = 86400000;
    const categories = [
      { id: 'dev', name: '开发工具', icon: '⌨️' }, { id: 'office', name: '效率办公', icon: '📊' },
      { id: 'media', name: '影音媒体', icon: '🎬' }, { id: 'system', name: '系统工具', icon: '🛠️' },
      { id: 'secure', name: '网络安全', icon: '🛡️' }, { id: 'design', name: '图形设计', icon: '🎨' },
      { id: 'game', name: '游戏娱乐', icon: '🎮' }, { id: 'ai', name: 'AI 工具', icon: '🤖' },
    ];
    const users = [
      { id: 'u_admin', username: 'admin', password: 'admin123', email: 'admin@softhub.io', role: 'admin', status: 'active', createdAt: now - 90 * day, lastLogin: now - day, color: '#6366f1' },
      { id: 'u_1', username: 'techmaster', password: '123456', email: 'tech@demo.com', role: 'user', status: 'active', createdAt: now - 60 * day, lastLogin: now - 2 * day, color: '#06b6d4' },
      { id: 'u_2', username: 'devlin', password: '123456', email: 'devlin@demo.com', role: 'user', status: 'active', createdAt: now - 45 * day, lastLogin: now - 5 * day, color: '#10b981' },
      { id: 'u_3', username: 'pixelcat', password: '123456', email: 'pixel@demo.com', role: 'user', status: 'active', createdAt: now - 30 * day, lastLogin: now - day, color: '#f59e0b' },
      { id: 'u_4', username: 'shadowfox', password: '123456', email: 'fox@demo.com', role: 'user', status: 'banned', createdAt: now - 20 * day, lastLogin: now - 10 * day, color: '#ef4444' },
      { id: 'u_5', username: 'lunar_dev', password: '123456', email: 'lunar@demo.com', role: 'user', status: 'active', createdAt: now - 8 * day, lastLogin: now - day, color: '#8b5cf6' },
    ];
    const palettes = [['#6366f1', '#06b6d4'], ['#ec4899', '#8b5cf6'], ['#10b981', '#06b6d4'], ['#f59e0b', '#ef4444'], ['#8b5cf6', '#6366f1'], ['#06b6d4', '#3b82f6'], ['#f43f5e', '#f59e0b'], ['#14b8a6', '#6366f1'], ['#0ea5e9', '#22d3ee'], ['#a855f7', '#ec4899'], ['#f97316', '#eab308'], ['#84cc16', '#10b981'], ['#ef4444', '#ec4899']];
    const softwares = [
      ['CodeFlow IDE', '3.2.1', 'dev', '⚡', ['Windows', 'macOS', 'Linux'], 245.6, '新一代轻量级集成开发环境，内置智能补全、Git 集成与远程开发支持，启动速度比传统 IDE 快 5 倍。', ['IDE', '编程', '智能补全'], 'u_1', 'approved', 15834, 42210, 4.8, 326, now - 55 * day, ''],
      ['PixelForge', '2.8.0', 'design', '🎨', ['Windows', 'macOS'], 512.3, '专业级位图与矢量混合编辑器，支持 PSD 导入、非破坏性图层与 AI 抠图，是设计师的全能工作台。', ['修图', '矢量', 'AI抠图'], 'u_3', 'approved', 9621, 28450, 4.6, 214, now - 48 * day, ''],
      ['NetGuard Pro', '5.1.4', 'secure', '🛡️', ['Windows'], 88.2, '实时网络防护工具，提供防火墙、流量监控、ARP 防护与恶意域名拦截，守护你的每一次连接。', ['防火墙', '流量监控'], 'u_2', 'approved', 7345, 19800, 4.5, 158, now - 42 * day, ''],
      ['CloudSync Drive', '1.9.7', 'office', '☁️', ['Windows', 'macOS', 'Linux'], 64.8, '跨平台文件同步工具，支持增量同步、端到端加密与版本回溯，让文件在所有设备间无缝流转。', ['同步', '加密', '备份'], 'u_1', 'approved', 12466, 31200, 4.7, 289, now - 38 * day, ''],
      ['WaveStudio', '4.0.2', 'media', '🎵', ['Windows', 'macOS'], 386.5, '专业音频工作站，多轨录音、VST 插件、AI 降噪一应俱全，从播客到编曲都能轻松驾驭。', ['音频', '录音', 'VST'], 'u_3', 'approved', 5233, 14520, 4.4, 97, now - 33 * day, ''],
      ['TurboClean', '7.3.0', 'system', '🚀', ['Windows'], 32.1, '系统深度清理与优化工具，一键清理垃圾文件、注册表冗余与启动项，让老电脑重获新生。', ['清理', '优化', '加速'], 'u_2', 'approved', 21077, 55340, 4.3, 502, now - 30 * day, ''],
      ['MindPalette AI', '0.9.5', 'ai', '🤖', ['Windows', 'macOS'], 156.9, '本地运行的 AI 绘画与文本生成客户端，支持多模型切换、离线推理与批量生成，创意从此不设限。', ['AI绘画', '大模型', '本地推理'], 'u_5', 'approved', 18902, 61200, 4.9, 431, now - 25 * day, ''],
      ['GameBooster X', '2.2.8', 'game', '🎮', ['Windows'], 45.7, '游戏加速与性能优化工具，智能释放内存、优化 GPU 调度，帧率提升看得见。', ['加速', 'FPS', '优化'], 'u_5', 'approved', 8810, 23100, 4.2, 176, now - 18 * day, ''],
      ['TermX Terminal', '1.4.3', 'dev', '💻', ['Windows', 'macOS', 'Linux'], 28.4, '现代化终端模拟器，GPU 加速渲染、分屏、SSH 管理与主题市场，让命令行也赏心悦目。', ['终端', 'SSH', 'GPU加速'], 'u_2', 'approved', 6120, 15900, 4.7, 143, now - 12 * day, ''],
      ['DocMaster Suite', '6.1.0', 'office', '📄', ['Windows', 'macOS'], 420.0, '全能文档套件，兼容主流格式，内置 PDF 编辑、OCR 识别与协同批注，办公效率翻倍。', ['文档', 'PDF', 'OCR'], 'u_1', 'approved', 4380, 11020, 4.1, 88, now - 9 * day, ''],
      ['VidCut Pro', '3.5.1', 'media', '✂️', ['Windows', 'macOS'], 298.6, '高效视频剪辑工具，硬件加速导出、智能字幕与丰富转场特效，短视频创作者首选。', ['剪辑', '字幕', '特效'], 'u_3', 'pending', 0, 320, 0, 0, now - 2 * day, ''],
      ['CryptoVault', '1.0.0', 'secure', '🔐', ['Windows', 'Linux'], 52.3, '本地密码管理器，AES-256 加密、生物识别解锁与安全审计，你的数字保险箱。', ['密码管理', '加密'], 'u_5', 'pending', 0, 150, 0, 0, now - day, ''],
      ['SpeedRacer 2077', '1.2.0', 'game', '🏎️', ['Windows'], 1843.0, '未来都市竞速游戏，光追画质与物理引擎带来极致驾驶体验。', ['竞速', '单机'], 'u_4', 'rejected', 0, 89, 0, 0, now - 6 * day, '安装包校验失败，疑似捆绑第三方插件'],
    ].map((a, i) => {
      const [c1, c2] = palettes[i % palettes.length];
      const data = coverSVG(a[0], c1, c2);
      return { id: 's_' + (i + 1), name: a[0], version: a[1], category: a[2], icon: a[3], os: a[4], size: a[5], desc: a[6], tags: a[7], uploaderId: a[8], status: a[9], downloads: a[10], views: a[11], rating: a[12], ratingCount: a[13], createdAt: a[14], homepage: a[15], rejectReason: a[16] || '', fileData: '', fileName: '', link: '', images: [{ id: 'i_s_' + (i + 1), data }], coverId: 'i_s_' + (i + 1) };
    });
    const comments = [
      { id: 'c_1', softwareId: 's_1', userId: 'u_2', content: '用了三个月，智能补全确实比同类产品准，内存占用也小。', time: now - 20 * day, status: 'visible' },
      { id: 'c_2', softwareId: 's_1', userId: 'u_3', content: '远程开发功能很稳，连服务器写代码零延迟的感觉。', time: now - 15 * day, status: 'visible' },
      { id: 'c_3', softwareId: 's_7', userId: 'u_1', content: '本地推理速度惊人，40 系显卡出图只要 2 秒！', time: now - 10 * day, status: 'visible' },
      { id: 'c_4', softwareId: 's_7', userId: 'u_2', content: '模型市场里的资源很全，一键下载就能用。', time: now - 8 * day, status: 'visible' },
      { id: 'c_5', softwareId: 's_6', userId: 'u_5', content: '清理完开机快了 20 秒，但广告弹窗有点多。', time: now - 5 * day, status: 'visible' },
      { id: 'c_6', softwareId: 's_4', userId: 'u_3', content: '端到端加密是刚需，终于不用担心隐私了。', time: now - 4 * day, status: 'visible' },
      { id: 'c_7', softwareId: 's_6', userId: 'u_4', content: '垃圾软件，纯广告！！！', time: now - 3 * day, status: 'hidden' },
      { id: 'c_8', softwareId: 's_9', userId: 'u_5', content: 'GPU 渲染丝般顺滑，主题市场太好看了。', time: now - 2 * day, status: 'visible' },
    ];
    const logs = [];
    const approvedIds = softwares.filter(s => s.status === 'approved').map(s => s.id);
    const userIds = [null, 'u_1', 'u_2', 'u_3', 'u_5', null, null];
    let seed = 7; const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let d = 13; d >= 0; d--) { const count = Math.floor(8 + rand() * 30 + (13 - d) * 1.5); for (let i = 0; i < count; i++) { logs.push({ id: 'l_' + d + '_' + i, softwareId: approvedIds[Math.floor(rand() * approvedIds.length)], userId: userIds[Math.floor(rand() * userIds.length)], time: now - d * day - Math.floor(rand() * day), ip: '192.168.' + Math.floor(rand() * 255) + '.' + Math.floor(rand() * 255) }); } }
    const announcements = [
      { id: 'a_1', title: '🎉 SoftHub 全新改版上线', content: '全新科技感界面、明暗模式自动切换，欢迎体验并反馈建议！', enabled: true, createdAt: now - 3 * day },
      { id: 'a_2', title: '📢 上传规范提醒', content: '请勿上传含捆绑插件的安装包，审核不通过将被驳回。', enabled: false, createdAt: now - 10 * day },
    ];
    const settings = {
      siteName: 'SoftHub',
      siteSlogan: '发现 · 分享 · 极致软件体验 —— 游客可自由浏览下载，注册后即可上传分享，可以在后台自由修改',
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
    };
    this.write('categories', categories); this.write('users', users); this.write('softwares', softwares);
    this.write('comments', comments); this.write('logs', logs); this.write('announcements', announcements); this.write('settings', settings);
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
  users() { return this.cache.users; },
  softwares() { return this.cache.softwares; },
  comments() { return this.cache.comments; },
  logs() { return this.cache.logs; },
  categories() { return this.cache.categories; },
  announcements() { return this.cache.announcements; },
  settings() { return this.cache.settings; },
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
    this.api('/api/collections/' + key, 'PUT', val); // 后台同步，失败静默
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
    if (this.mode === 'remote') { const r = await this.api('/api/reset', 'POST'); if (r && r.ok) await this.init(); return; }
    Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k));
    this.seedLocal(); this.cache = this.loadLocal();
  },
};

/* =====================================================
 * 通用工具
 * ===================================================== */
const U = {
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); },
  fmtSize(mb) { if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'; return mb.toFixed(1) + ' MB'; },
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
  compressImage(file, maxDim = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) { const scale = maxDim / Math.max(width, height); width = Math.round(width * scale); height = Math.round(height * scale); }
          const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) { resolve(reader.result); }
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  },
  coverOf(s) { const imgs = s.images || []; const cover = imgs.find(i => i.id === s.coverId) || imgs[0]; return cover ? cover.data : null; },
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
      xhr.onerror = () => reject(new Error('网络错误，上传失败'));
      xhr.send(JSON.stringify(body));
    });
  },
  downloadSoftFile(s) {
    if (s.link) { window.open(s.link, '_blank', 'noopener'); return; }
    const a = document.createElement('a');
    if (s.fileData) { a.href = s.fileData; a.download = s.fileName || (s.name + '-v' + s.version); }
    else {
      const blob = new Blob([`SoftHub 演示下载\n=================\n软件：${s.name} v${s.version}\n大小：${U.fmtSize(s.size)}\n说明：演示环境未存储真实安装包，此文件为占位下载。`], { type: 'text/plain' });
      a.href = URL.createObjectURL(blob); a.download = `${s.name}-v${s.version}.txt`;
    }
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
