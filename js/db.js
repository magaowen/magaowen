/* =====================================================
 * SoftHub 数据层 (localStorage 模拟数据库)
 * ===================================================== */
const DB = {
  prefix: 'sh_',
  read(key, def) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  },
  write(key, val) {
    localStorage.setItem(this.prefix + key, JSON.stringify(val));
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  /* ---------- 初始化种子数据 ---------- */
  init() {
    if (this.read('inited', false)) return;
    const now = Date.now();
    const day = 86400000;

    const categories = [
      { id: 'dev',    name: '开发工具',   icon: '⌨️' },
      { id: 'office', name: '效率办公',   icon: '📊' },
      { id: 'media',  name: '影音媒体',   icon: '🎬' },
      { id: 'system', name: '系统工具',   icon: '🛠️' },
      { id: 'secure', name: '网络安全',   icon: '🛡️' },
      { id: 'design', name: '图形设计',   icon: '🎨' },
      { id: 'game',   name: '游戏娱乐',   icon: '🎮' },
      { id: 'ai',     name: 'AI 工具',    icon: '🤖' },
    ];

    const users = [
      { id: 'u_admin', username: 'admin',  password: 'admin123', email: 'admin@softhub.io',  role: 'admin', status: 'active', createdAt: now - 90 * day, lastLogin: now - day, color: '#6366f1' },
      { id: 'u_1', username: 'techmaster', password: '123456', email: 'tech@demo.com',   role: 'user', status: 'active', createdAt: now - 60 * day, lastLogin: now - 2 * day,  color: '#06b6d4' },
      { id: 'u_2', username: 'devlin',     password: '123456', email: 'devlin@demo.com', role: 'user', status: 'active', createdAt: now - 45 * day, lastLogin: now - 5 * day,  color: '#10b981' },
      { id: 'u_3', username: 'pixelcat',   password: '123456', email: 'pixel@demo.com',  role: 'user', status: 'active', createdAt: now - 30 * day, lastLogin: now - day,      color: '#f59e0b' },
      { id: 'u_4', username: 'shadowfox',  password: '123456', email: 'fox@demo.com',    role: 'user', status: 'banned', createdAt: now - 20 * day, lastLogin: now - 10 * day, color: '#ef4444' },
      { id: 'u_5', username: 'lunar_dev',  password: '123456', email: 'lunar@demo.com',  role: 'user', status: 'active', createdAt: now - 8 * day,  lastLogin: now - day,      color: '#8b5cf6' },
    ];

    const softwares = [
      { id: 's_1',  name: 'CodeFlow IDE',      version: '3.2.1',  category: 'dev',    icon: '⚡', os: ['Windows', 'macOS', 'Linux'], size: 245.6, desc: '新一代轻量级集成开发环境，内置智能补全、Git 集成与远程开发支持，启动速度比传统 IDE 快 5 倍。', tags: ['IDE', '编程', '智能补全'], uploaderId: 'u_1', status: 'approved', downloads: 15834, views: 42210, rating: 4.8, ratingCount: 326, createdAt: now - 55 * day, homepage: 'https://example.com/codeflow' },
      { id: 's_2',  name: 'PixelForge',        version: '2.8.0',  category: 'design', icon: '🎨', os: ['Windows', 'macOS'],          size: 512.3, desc: '专业级位图与矢量混合编辑器，支持 PSD 导入、非破坏性图层与 AI 抠图，是设计师的全能工作台。', tags: ['修图', '矢量', 'AI抠图'], uploaderId: 'u_3', status: 'approved', downloads: 9621, views: 28450, rating: 4.6, ratingCount: 214, createdAt: now - 48 * day, homepage: '' },
      { id: 's_3',  name: 'NetGuard Pro',      version: '5.1.4',  category: 'secure', icon: '🛡️', os: ['Windows'],                   size: 88.2,  desc: '实时网络防护工具，提供防火墙、流量监控、ARP 防护与恶意域名拦截，守护你的每一次连接。', tags: ['防火墙', '流量监控'], uploaderId: 'u_2', status: 'approved', downloads: 7345, views: 19800, rating: 4.5, ratingCount: 158, createdAt: now - 42 * day, homepage: '' },
      { id: 's_4',  name: 'CloudSync Drive',   version: '1.9.7',  category: 'office', icon: '☁️', os: ['Windows', 'macOS', 'Linux'], size: 64.8,  desc: '跨平台文件同步工具，支持增量同步、端到端加密与版本回溯，让文件在所有设备间无缝流转。', tags: ['同步', '加密', '备份'], uploaderId: 'u_1', status: 'approved', downloads: 12466, views: 31200, rating: 4.7, ratingCount: 289, createdAt: now - 38 * day, homepage: '' },
      { id: 's_5',  name: 'WaveStudio',        version: '4.0.2',  category: 'media',  icon: '🎵', os: ['Windows', 'macOS'],          size: 386.5, desc: '专业音频工作站，多轨录音、VST 插件、AI 降噪一应俱全，从播客到编曲都能轻松驾驭。', tags: ['音频', '录音', 'VST'], uploaderId: 'u_3', status: 'approved', downloads: 5233, views: 14520, rating: 4.4, ratingCount: 97, createdAt: now - 33 * day, homepage: '' },
      { id: 's_6',  name: 'TurboClean',        version: '7.3.0',  category: 'system', icon: '🚀', os: ['Windows'],                   size: 32.1,  desc: '系统深度清理与优化工具，一键清理垃圾文件、注册表冗余与启动项，让老电脑重获新生。', tags: ['清理', '优化', '加速'], uploaderId: 'u_2', status: 'approved', downloads: 21077, views: 55340, rating: 4.3, ratingCount: 502, createdAt: now - 30 * day, homepage: '' },
      { id: 's_7',  name: 'MindPalette AI',    version: '0.9.5',  category: 'ai',     icon: '🤖', os: ['Windows', 'macOS'],          size: 156.9, desc: '本地运行的 AI 绘画与文本生成客户端，支持多模型切换、离线推理与批量生成，创意从此不设限。', tags: ['AI绘画', '大模型', '本地推理'], uploaderId: 'u_5', status: 'approved', downloads: 18902, views: 61200, rating: 4.9, ratingCount: 431, createdAt: now - 25 * day, homepage: '' },
      { id: 's_8',  name: 'GameBooster X',     version: '2.2.8',  category: 'game',   icon: '🎮', os: ['Windows'],                   size: 45.7,  desc: '游戏加速与性能优化工具，智能释放内存、优化 GPU 调度，帧率提升看得见。', tags: ['加速', 'FPS', '优化'], uploaderId: 'u_5', status: 'approved', downloads: 8810, views: 23100, rating: 4.2, ratingCount: 176, createdAt: now - 18 * day, homepage: '' },
      { id: 's_9',  name: 'TermX Terminal',    version: '1.4.3',  category: 'dev',    icon: '💻', os: ['Windows', 'macOS', 'Linux'], size: 28.4,  desc: '现代化终端模拟器，GPU 加速渲染、分屏、SSH 管理与主题市场，让命令行也赏心悦目。', tags: ['终端', 'SSH', 'GPU加速'], uploaderId: 'u_2', status: 'approved', downloads: 6120, views: 15900, rating: 4.7, ratingCount: 143, createdAt: now - 12 * day, homepage: '' },
      { id: 's_10', name: 'DocMaster Suite',   version: '6.1.0',  category: 'office', icon: '📄', os: ['Windows', 'macOS'],          size: 420.0, desc: '全能文档套件，兼容主流格式，内置 PDF 编辑、OCR 识别与协同批注，办公效率翻倍。', tags: ['文档', 'PDF', 'OCR'], uploaderId: 'u_1', status: 'approved', downloads: 4380, views: 11020, rating: 4.1, ratingCount: 88, createdAt: now - 9 * day, homepage: '' },
      { id: 's_11', name: 'VidCut Pro',        version: '3.5.1',  category: 'media',  icon: '✂️', os: ['Windows', 'macOS'],          size: 298.6, desc: '高效视频剪辑工具，硬件加速导出、智能字幕与丰富转场特效，短视频创作者首选。', tags: ['剪辑', '字幕', '特效'], uploaderId: 'u_3', status: 'pending', downloads: 0, views: 320, rating: 0, ratingCount: 0, createdAt: now - 2 * day, homepage: '' },
      { id: 's_12', name: 'CryptoVault',       version: '1.0.0',  category: 'secure', icon: '🔐', os: ['Windows', 'Linux'],          size: 52.3,  desc: '本地密码管理器，AES-256 加密、生物识别解锁与安全审计，你的数字保险箱。', tags: ['密码管理', '加密'], uploaderId: 'u_5', status: 'pending', downloads: 0, views: 150, rating: 0, ratingCount: 0, createdAt: now - day, homepage: '' },
      { id: 's_13', name: 'SpeedRacer 2077',   version: '1.2.0',  category: 'game',   icon: '🏎️', os: ['Windows'],                  size: 1843.0, desc: '未来都市竞速游戏，光追画质与物理引擎带来极致驾驶体验。', tags: ['竞速', '单机'], uploaderId: 'u_4', status: 'rejected', rejectReason: '安装包校验失败，疑似捆绑第三方插件', downloads: 0, views: 89, rating: 0, ratingCount: 0, createdAt: now - 6 * day, homepage: '' },
    ];

    // 为每款软件生成渐变封面图（演示数据，真实上传会替换）
    const palettes = [
      ['#6366f1', '#06b6d4'], ['#ec4899', '#8b5cf6'], ['#10b981', '#06b6d4'],
      ['#f59e0b', '#ef4444'], ['#8b5cf6', '#6366f1'], ['#06b6d4', '#3b82f6'],
      ['#f43f5e', '#f59e0b'], ['#14b8a6', '#6366f1'], ['#0ea5e9', '#22d3ee'],
      ['#a855f7', '#ec4899'], ['#f97316', '#eab308'], ['#84cc16', '#10b981'],
      ['#ef4444', '#ec4899'],
    ];
    softwares.forEach((s, i) => {
      const [c1, c2] = palettes[i % palettes.length];
      const data = coverSVG(s.name, c1, c2);
      s.images = [{ id: 'i_' + s.id, data }];
      s.coverId = 'i_' + s.id;
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

    // 生成近 14 天下载记录（用于图表）
    const logs = [];
    const approvedIds = softwares.filter(s => s.status === 'approved').map(s => s.id);
    const userIds = [null, 'u_1', 'u_2', 'u_3', 'u_5', null, null];
    let seed = 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let d = 13; d >= 0; d--) {
      const count = Math.floor(8 + rand() * 30 + (13 - d) * 1.5);
      for (let i = 0; i < count; i++) {
        const t = now - d * day - Math.floor(rand() * day);
        logs.push({
          id: 'l_' + d + '_' + i,
          softwareId: approvedIds[Math.floor(rand() * approvedIds.length)],
          userId: userIds[Math.floor(rand() * userIds.length)],
          time: t,
          ip: '192.168.' + Math.floor(rand() * 255) + '.' + Math.floor(rand() * 255),
        });
      }
    }

    const announcements = [
      { id: 'a_1', title: '🎉 SoftHub 全新改版上线', content: '全新科技感界面、明暗模式自动切换，欢迎体验并反馈建议！', enabled: true, createdAt: now - 3 * day },
      { id: 'a_2', title: '📢 上传规范提醒', content: '请勿上传含捆绑插件的安装包，审核不通过将被驳回。', enabled: false, createdAt: now - 10 * day },
    ];

    const settings = {
      siteName: 'SoftHub',
      siteSlogan: '发现 · 分享 · 极致软件体验',
      requireReview: true,
      allowRegister: true,
      allowComment: true,
      maxUploadMB: 2048,
      maintenance: false,
    };

    this.write('categories', categories);
    this.write('users', users);
    this.write('softwares', softwares);
    this.write('comments', comments);
    this.write('logs', logs);
    this.write('announcements', announcements);
    this.write('settings', settings);
    this.write('inited', true);
  },
  /* ---------- 快捷访问 ---------- */
  users()     { return this.read('users', []); },
  softwares() { return this.read('softwares', []); },
  comments()  { return this.read('comments', []); },
  logs()      { return this.read('logs', []); },
  categories(){ return this.read('categories', []); },
  announcements() { return this.read('announcements', []); },
  settings()  { return this.read('settings', {}); },

  saveUsers(v)     { this.write('users', v); },
  saveSoftwares(v) { this.write('softwares', v); },
  saveComments(v)  { this.write('comments', v); },
  saveLogs(v)      { this.write('logs', v); },
  saveCategories(v){ this.write('categories', v); },
  saveAnnouncements(v) { this.write('announcements', v); },
  saveSettings(v)  { this.write('settings', v); },

  userById(id) { return this.users().find(u => u.id === id); },
  softwareById(id) { return this.softwares().find(s => s.id === id); },
  categoryById(id) { return this.categories().find(c => c.id === id); },

  /* ---------- 会话 ---------- */
  session() {
    const id = this.read('session', null);
    return id ? this.userById(id) : null;
  },
  login(id)  { this.write('session', id); },
  logout()   { localStorage.removeItem(this.prefix + 'session'); },

  /* ---------- 重置演示数据 ---------- */
  reset() {
    Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k));
    this.init();
  },
};

/* =====================================================
 * 通用工具
 * ===================================================== */
const U = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },
  fmtSize(mb) {
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
    return mb.toFixed(1) + ' MB';
  },
  fmtNum(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  },
  fmtDate(t) {
    const d = new Date(t);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  fmtTime(t) {
    const d = new Date(t);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },
  ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    return this.fmtDate(t);
  },
  stars(r) {
    const full = Math.round(r);
    let html = '';
    for (let i = 1; i <= 5; i++) html += `<span class="star ${i <= full ? 'on' : ''}">★</span>`;
    return html;
  },
  toast(msg, type = 'info') {
    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = `<span>${type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ'}</span>${U.esc(msg)}`;
    box.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
  },
  /* 页面内自定义确认框（替代被沙箱禁用的 window.confirm） */
  confirmBox(msg, onOk, onCancel) { U.confirm(msg, onOk, onCancel); },
  confirm(msg, onOk, onCancel) {
    const box = document.createElement('div');
    box.className = 'modal-mask';
    box.innerHTML = `<div class="modal" style="max-width:430px">
      <div class="modal-confirm-body">${U.esc(msg)}</div>
      <div class="modal-confirm-actions">
        <button class="btn" id="uiCancel">取消</button>
        <button class="btn btn-primary" id="uiOk">确定</button>
      </div></div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('open'));
    box.querySelector('#uiCancel').onclick = () => { box.remove(); onCancel && onCancel(); };
    box.querySelector('#uiOk').onclick = () => { box.remove(); onOk && onOk(); };
    box.onclick = e => { if (e.target === box) { box.remove(); onCancel && onCancel(); } };
  },
  /* 页面内自定义输入框（替代被沙箱禁用的 window.prompt） */
  prompt(msg, onOk, def) {
    const box = document.createElement('div');
    box.className = 'modal-mask';
    box.innerHTML = `<div class="modal" style="max-width:440px">
      <div class="modal-confirm-body" style="margin-bottom:10px">${U.esc(msg)}</div>
      <input id="uiPromptVal" value="${U.esc(def || '')}" style="width:100%">
      <div class="modal-confirm-actions" style="margin-top:16px">
        <button class="btn" id="uiCancel">取消</button>
        <button class="btn btn-primary" id="uiOk">确定</button>
      </div></div>`;
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('open'));
    const input = box.querySelector('#uiPromptVal');
    input.focus(); input.select();
    const done = () => { const v = input.value; box.remove(); onOk && onOk(v); };
    box.querySelector('#uiCancel').onclick = () => box.remove();
    box.querySelector('#uiOk').onclick = done;
    input.onkeydown = e => { if (e.key === 'Enter') done(); };
    box.onclick = e => { if (e.target === box) box.remove(); };
  },
  /* 将图片文件压缩为 dataURL（控制体积，便于本地存储） */
  compressImage(file, maxDim = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          try { resolve(canvas.toDataURL('image/jpeg', quality)); }
          catch (e) { resolve(reader.result); }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  /* 取软件封面图 dataURL（无图返回 null） */
  coverOf(s) {
    const imgs = s.images || [];
    const cover = imgs.find(i => i.id === s.coverId) || imgs[0];
    return cover ? cover.data : null;
  },
  /* 触发软件下载：有真实安装包则下载真实文件，否则下载占位说明文件（前台/后台共用） */
  downloadSoftFile(s) {
    const a = document.createElement('a');
    if (s.fileData) {
      a.href = s.fileData;
      a.download = s.fileName || (s.name + '-v' + s.version);
    } else {
      const blob = new Blob(
        [`SoftHub 演示下载\n=================\n软件：${s.name} v${s.version}\n大小：${U.fmtSize(s.size)}\n说明：演示环境未存储真实安装包，此文件为占位下载。`],
        { type: 'text/plain' });
      a.href = URL.createObjectURL(blob);
      a.download = `${s.name}-v${s.version}.txt`;
    }
    document.body.appendChild(a); a.click(); a.remove();
  },
  /* 渲染图片上传器（mountId 容器，state 持有 images/coverId，obj 实例用于回调，ns 命名空间字符串用于内联事件） */
  renderImageUploader(mountId, state, obj, ns) {
    const box = document.getElementById(mountId);
    if (!box) return;
    const imgs = state.images || [];
    let html = `<div class="img-uploader">
      <div class="img-add" id="${mountId}_add"><span style="font-size:26px">🖼️</span><span>点击或拖拽上传图片（可多张）</span></div>
      <input type="file" id="${mountId}_file" accept="image/*" multiple style="display:none">`;
    if (imgs.length) {
      html += `<div class="img-grid">` + imgs.map(im => `
        <div class="img-item ${im.id === state.coverId ? 'cover' : ''}">
          <img src="${im.data}" alt="">
          ${im.id === state.coverId ? '<span class="img-cover-badge">首图</span>' : ''}
          <div class="img-actions">
            <button class="img-set-cover" title="设为首图" onclick="${ns}.setCover('${im.id}')">★</button>
            <button class="img-remove" title="删除" onclick="${ns}.removeImage('${im.id}')">✕</button>
          </div>
        </div>`).join('') + `</div>`;
    }
    html += `</div>`;
    box.innerHTML = html;
    const add = document.getElementById(mountId + '_add');
    const input = document.getElementById(mountId + '_file');
    add.onclick = () => input.click();
    input.onchange = () => { obj.addImageFiles(input.files); input.value = ''; };
    add.ondragover = e => { e.preventDefault(); add.classList.add('drag'); };
    add.ondragleave = () => add.classList.remove('drag');
    add.ondrop = e => { e.preventDefault(); add.classList.remove('drag'); if (e.dataTransfer.files[0]) obj.addImageFiles(e.dataTransfer.files); };
  },
};

/* 生成渐变封面图（用于种子数据，真实上传会替换） */
function coverSVG(name, c1, c2) {
  const safe = String(name || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>
    <rect width='600' height='400' fill='url(#g)'/>
    <circle cx='500' cy='80' r='120' fill='rgba(255,255,255,.12)'/>
    <circle cx='90' cy='340' r='90' fill='rgba(255,255,255,.10)'/>
    <text x='50%' y='54%' font-size='52' fill='rgba(255,255,255,.95)' text-anchor='middle' font-family='sans-serif' font-weight='800'>${safe}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* =====================================================
 * 主题管理：auto(跟随系统) / light / dark
 * ===================================================== */
const Theme = {
  get() { return localStorage.getItem('sh_theme_mode') || 'auto'; },
  set(mode) {
    localStorage.setItem('sh_theme_mode', mode);
    this.apply();
  },
  apply() {
    const mode = this.get();
    let dark = mode === 'dark';
    if (mode === 'auto') dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.textContent = mode === 'auto' ? '🌗' : (mode === 'dark' ? '🌙' : '☀️');
      btn.title = '主题模式：' + (mode === 'auto' ? '跟随系统' : mode === 'dark' ? '深色' : '浅色') + '（点击切换）';
    });
  },
  cycle() {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(this.get()) + 1) % 3];
    this.set(next);
    U.toast('主题已切换为：' + (next === 'auto' ? '跟随系统 🌗' : next === 'dark' ? '深色 🌙' : '浅色 ☀️'));
  },
  init() {
    this.apply();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.get() === 'auto') this.apply();
    });
  },
};

DB.init();
/* 数据迁移：为缺少图片字段的旧数据补生成封面（仅执行一次） */
(function migrate() {
  if (DB.read('migrated_img', false)) return;
  const softs = DB.softwares();
  const palettes = [
    ['#6366f1', '#06b6d4'], ['#ec4899', '#8b5cf6'], ['#10b981', '#06b6d4'],
    ['#f59e0b', '#ef4444'], ['#8b5cf6', '#6366f1'], ['#06b6d4', '#3b82f6'],
    ['#f43f5e', '#f59e0b'], ['#14b8a6', '#6366f1'], ['#0ea5e9', '#22d3ee'],
    ['#a855f7', '#ec4899'],
  ];
  let changed = false;
  softs.forEach((s, i) => {
    if (!s.images || !s.images.length) {
      const [c1, c2] = palettes[i % palettes.length];
      const data = coverSVG(s.name, c1, c2);
      s.images = [{ id: 'i_' + s.id, data }];
      s.coverId = 'i_' + s.id;
      changed = true;
    }
  });
  if (changed) DB.saveSoftwares(softs);
  DB.write('migrated_img', true);
})();
Theme.init();
