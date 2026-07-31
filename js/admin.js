/* =====================================================
 * SoftHub 后台管理
 * ===================================================== */
const Admin = {
  page: 'dash',
  filters: { softStatus: 'all', softCat: 'all', softKw: '', userKw: '', cmtStatus: 'all', logSoft: 'all' },

  /* ================= 入口 ================= */
  init() {
    const me = DB.session();
    if (!me || me.role !== 'admin') { this.renderGate(); return; }
    this.renderLayout();
    this.go('dash');
  },

  renderGate() {
    document.getElementById('root').innerHTML = `
      <div class="gate">
        <div class="modal" style="max-width:400px">
          <div style="text-align:center;margin-bottom:8px">
            <div style="font-size:44px">🛠️</div>
            <h3 style="font-size:20px;margin-top:8px">后台管理登录</h3>
            <p class="hint">仅管理员账户可进入</p>
          </div>
          <label>用户名</label><input id="gUser" value="admin">
          <label>密码</label><input id="gPass" type="password" placeholder="admin123">
          <button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="Admin.gateLogin()">进入后台</button>
          <p class="hint" style="text-align:center;margin-top:14px"><a href="index.html">← 返回前台</a></p>
        </div>
      </div>`;
    document.getElementById('gPass').addEventListener('keydown', e => { if (e.key === 'Enter') Admin.gateLogin(); });
  },
  async gateLogin() {
    const name = document.getElementById('gUser').value.trim();
    const pass = document.getElementById('gPass').value;
    const me = await DB.login(name, pass);
    if (!me) return;
    if (me.role !== 'admin') { U.toast('该账户不是管理员', 'err'); DB.logout(); return; }
    this.init();
  },

  /* ================= 布局 ================= */
  menus: [
    ['dash',   '📊', '仪表盘'],
    ['review', '⏳', '审核队列'],
    ['softs',  '📦', '软件管理'],
    ['users',  '👥', '用户管理'],
    ['cmts',   '💬', '评论管理'],
    ['cats',   '🗂️', '分类管理'],
    ['logs',   '⬇️', '下载记录'],
    ['annos',  '📣', '公告管理'],
    ['set',    '⚙️', '站点设置'],
    ['sys',    '💻', '硬件信息'],
  ],
  renderLayout() {
    const me = DB.session();
    document.getElementById('root').innerHTML = `
      <div class="admin-layout">
        <aside class="sidebar">
          <div class="sb-logo"><span class="ic">⚡</span><span class="txt">${U.esc(DB.settings().siteName || 'SoftHub')} 后台</span></div>
          ${this.menus.map(([id, ic, name]) => `
            <button class="sb-item" id="sb_${id}" onclick="Admin.go('${id}')">
              <span>${ic}</span><span class="txt">${name}</span>
              ${id === 'review' ? '<span class="cnt" id="pendingCnt" style="display:none"></span>' : ''}
            </button>`).join('')}
          <div class="sb-foot">
            <button class="sb-item sb-upload" onclick="Admin.openUpload()"><span>📤</span><span class="txt">上传软件（免审核）</span></button>
            <button class="sb-item" onclick="location.href='index.html'"><span>🏠</span><span class="txt">返回前台</span></button>
            <button class="sb-item" onclick="Theme.cycle()"><span>🌗</span><span class="txt">切换主题</span></button>
            <button class="sb-item" style="color:var(--err)" onclick="DB.logout();location.reload()"><span>🚪</span><span class="txt">退出（${U.esc(me.username)}）</span></button>
          </div>
        </aside>
        <main class="main" id="mainBox"></main>
      </div>
      <div class="modal-mask" id="adminModal"><div class="modal" id="adminModalBody"></div></div>`;
    document.getElementById('adminModal').addEventListener('click', e => {
      if (e.target.id === 'adminModal') e.target.classList.remove('open');
    });
  },
  go(page) {
    this.page = page;
    this.menus.forEach(([id]) => {
      const el = document.getElementById('sb_' + id);
      if (el) el.classList.toggle('on', id === page);
    });
    this.updatePendingBadge();
    const fn = { dash: 'pDash', review: 'pReview', softs: 'pSofts', users: 'pUsers', cmts: 'pCmts', cats: 'pCats', logs: 'pLogs', annos: 'pAnnos', set: 'pSet', sys: 'pSys' }[page];
    this[fn]();
  },
  updatePendingBadge() {
    const n = DB.softwares().filter(s => s.status === 'pending').length;
    const el = document.getElementById('pendingCnt');
    if (el) { el.style.display = n ? '' : 'none'; el.textContent = n; }
  },
  modal(html) {
    document.getElementById('adminModalBody').innerHTML = html;
    document.getElementById('adminModal').classList.add('open');
  },
  closeModal() { document.getElementById('adminModal').classList.remove('open'); },

  /* ================= 后台直接上传（免审核） ================= */
  openUpload() {
    const me = DB.session();
    this.adminUploadState = { uploadFile: null, images: [], coverId: null };
    this.imgState = this.adminUploadState; this.imgMount = 'aImages';
    this.modal(`
      <div class="modal-head"><h3>📤 后台上传软件</h3><button class="modal-close" onclick="Admin.closeModal()">✕</button></div>
      <p class="hint" style="color:var(--ok)">✅ 管理员上传将<b>直接上架</b>，无需经过审核队列，立即在前台可见。上传者记为「${U.esc(me.username)}」。</p>
      <div class="form-row">
        <div><label>软件名称 *</label><input id="aName" placeholder="如 CodeFlow IDE"></div>
        <div><label>版本号 *</label><input id="aVer" placeholder="如 1.0.0"></div>
      </div>
      <div class="form-row">
        <div><label>分类 *</label><select id="aCat">${DB.categories().map(c => `<option value="${c.id}">${U.esc(c.name)}</option>`).join('')}</select></div>
        <div><label>图标（可选 Emoji，无封面图时显示）</label><input id="aIcon" placeholder="如 🚀" maxlength="4"></div>
      </div>
      <label>支持平台 *</label>
      <div style="display:flex;gap:14px;font-size:13.5px;color:var(--text2);flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="aOs" value="Windows" style="width:auto" checked>Windows</label>
        <label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="aOs" value="macOS" style="width:auto">macOS</label>
        <label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="aOs" value="Linux" style="width:auto">Linux</label>
        <label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="aOs" value="Android" style="width:auto">Android</label>
        <label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" class="aOs" value="iOS" style="width:auto">iOS</label>
      </div>
      <label>软件简介 *</label><textarea id="aDesc" rows="3" placeholder="介绍软件的核心功能与亮点…"></textarea>
      <label>标签（用逗号分隔）</label><input id="aTags" placeholder="如 效率, 开源, 免费">
      <label>官网链接（选填）</label><input id="aHome" placeholder="https://...">
      <label>下载链接（选填）<span class="hint" style="margin:0">填了则前台下载跳转该链接；不填则使用下面的安装包文件</span></label>
      <input id="aLink" placeholder="https://...">
      <label>安装包文件</label>
      <div class="dropzone" id="aDropzone" onclick="document.getElementById('aFile').click()">
        <span class="dz-icon">📦</span>
        <span id="aDzText">点击选择或拖拽文件到此处（演示环境 ≤2MB 会真实存储，超出仅记录元信息）</span>
      </div>
      <input type="file" id="aFile" style="display:none">
      <label>软件图片（至少 1 张，可设首图）*</label>
      <div id="aImages"></div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn-primary" style="flex:1" onclick="Admin.doUpload()">直接上架发布</button>
        <button class="btn" onclick="Admin.closeModal()">取消</button>
      </div>`);
    U.renderImageUploader('aImages', this.adminUploadState, this, 'Admin');
    const dz = document.getElementById('aDropzone');
    const fi = document.getElementById('aFile');
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('drag'); if (e.dataTransfer.files[0]) Admin.aAddFiles(e.dataTransfer.files); };
    fi.onchange = () => { if (fi.files[0]) Admin.aAddFiles(fi.files); };
  },
  aAddFiles(files) {
    const file = files[0]; if (!file) return;
    const onText = txt => { const el = document.getElementById('aDzText'); if (el) el.textContent = txt; };
    if (file.size > 2 * 1024 * 1024) {
      onText(`⚠️ ${file.name}（${(file.size / 1048576).toFixed(2)}MB）超出 2MB，将仅记录元信息`);
      this.adminUploadState.uploadFile = { fileData: '', fileName: file.name, sizeMB: +(file.size / 1048576).toFixed(2) };
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const sizeMB = +(file.size / 1048576).toFixed(2);
      this.adminUploadState.uploadFile = { fileData: reader.result, fileName: file.name, sizeMB };
      onText(`✅ 已选择：${file.name}（${sizeMB}MB，可真实下载）`);
    };
    reader.onerror = () => U.toast('文件读取失败', 'err');
    reader.readAsDataURL(file);
  },
  doUpload() {
    const name = document.getElementById('aName').value.trim();
    const ver = document.getElementById('aVer').value.trim();
    const cat = document.getElementById('aCat').value;
    const icon = document.getElementById('aIcon').value.trim();
    const desc = document.getElementById('aDesc').value.trim();
    const tags = document.getElementById('aTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    const os = [...document.querySelectorAll('.aOs')].filter(c => c.checked).map(c => c.value);
    const link = document.getElementById('aLink').value.trim();
    if (!name || !ver || !desc) { U.toast('请填写名称、版本和简介', 'err'); return; }
    if (!os.length) { U.toast('请至少选择一个支持平台', 'err'); return; }
    if (!this.adminUploadState.images.length) { U.toast('请至少上传一张软件图片', 'err'); return; }
    const f = this.adminUploadState.uploadFile || {};
    const me = DB.session();
    const coverId = this.adminUploadState.coverId || this.adminUploadState.images[0].id;
    const softs = DB.softwares();
    softs.push({
      id: 's_' + DB.uid(), name, version: ver, category: cat, icon: icon || '📦', os,
      size: f.sizeMB || 0, desc, tags, uploaderId: me.id,
      status: 'approved', downloads: 0, views: 0, rating: 0, ratingCount: 0,
      createdAt: Date.now(), homepage: document.getElementById('aHome').value.trim(),
      fileName: f.fileName || '', fileData: f.fileData || '',
      downloadUrl: link || '',
      images: this.adminUploadState.images, coverId,
    });
    DB.saveSoftwares(softs);
    this.closeModal();
    U.toast(`「${name}」已直接上架，前台立即可见`, 'ok');
    this.go('softs');
  },
  /* 后台下载（审核/管理用，不计入公开下载量） */
  downloadSoft(id) {
    const s = DB.softwareById(id);
    if (!s) return;
    if (s.downloadUrl) { window.open(s.downloadUrl, '_blank', 'noopener'); U.toast(`已在浏览器新窗口打开「${s.name}」的下载链接`, 'ok'); return; }
    U.downloadSoftFile(s);
    U.toast(`开始下载 ${s.name}${s.fileData ? '' : '（占位文件，演示环境未存真实包）'}`, 'ok');
  },

  /* ================= 图表工具（原生 Canvas） ================= */
  cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
  setupCanvas(id, h) {
    const c = document.getElementById(id);
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || c.parentElement.clientWidth - 40;
    c.width = w * dpr; c.height = h * dpr;
    c.style.height = h + 'px';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  },
  lineChart(id, labels, data) {
    const { ctx, w, h } = this.setupCanvas(id, 240);
    const pad = { l: 40, r: 14, t: 16, b: 28 };
    const max = Math.max(...data, 1) * 1.15;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const x = i => pad.l + iw * (i / (data.length - 1));
    const y = v => pad.t + ih * (1 - v / max);
    const grid = this.cssVar('--border'), txt = this.cssVar('--text3');
    const p1 = '#6366f1', p2 = '#06b6d4';
    // 网格
    ctx.strokeStyle = grid; ctx.fillStyle = txt; ctx.font = '10.5px sans-serif'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = pad.t + ih * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(w - pad.r, gy); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(max * (1 - i / 4)), pad.l - 7, gy + 3.5);
    }
    ctx.textAlign = 'center';
    labels.forEach((lb, i) => { if (i % 2 === 0) ctx.fillText(lb, x(i), h - 8); });
    // 渐变面积
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, 'rgba(99,102,241,.30)'); grad.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.beginPath(); ctx.moveTo(x(0), y(data[0]));
    data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(data.length - 1), h - pad.b); ctx.lineTo(x(0), h - pad.b); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // 线
    const lg = ctx.createLinearGradient(pad.l, 0, w - pad.r, 0);
    lg.addColorStop(0, p1); lg.addColorStop(1, p2);
    ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = lg; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    // 点
    data.forEach((v, i) => {
      ctx.beginPath(); ctx.arc(x(i), y(v), 3.2, 0, 7);
      ctx.fillStyle = this.cssVar('--card-solid') || '#fff'; ctx.fill();
      ctx.strokeStyle = p1; ctx.lineWidth = 2; ctx.stroke();
    });
  },
  doughnut(id, items) {
    const { ctx, w, h } = this.setupCanvas(id, 240);
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f87171', '#38bdf8'];
    const total = items.reduce((a, x) => a + x.value, 0) || 1;
    const cx = w * 0.32, cy = h / 2, R = Math.min(cx, cy) - 14, r = R * 0.62;
    let ang = -Math.PI / 2;
    items.forEach((it, i) => {
      const a2 = ang + (it.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, ang, a2); ctx.arc(cx, cy, r, a2, ang, true); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      ang = a2;
    });
    ctx.fillStyle = this.cssVar('--text'); ctx.textAlign = 'center';
    ctx.font = '700 20px sans-serif'; ctx.fillText(String(total), cx, cy + 2);
    ctx.font = '10.5px sans-serif'; ctx.fillStyle = this.cssVar('--text3'); ctx.fillText('总数', cx, cy + 18);
    // 图例
    ctx.textAlign = 'left'; ctx.font = '12px sans-serif';
    let ly = cy - items.length * 10 + 4;
    items.forEach((it, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(w * 0.60, ly - 8, 10, 10);
      ctx.fillStyle = this.cssVar('--text2');
      ctx.fillText(`${it.label}  ${it.value} (${Math.round(it.value / total * 100)}%)`, w * 0.60 + 17, ly + 1);
      ly += 20;
    });
  },
  hbar(id, items) {
    const rows = items.length || 1;
    const rowH = 34;
    const { ctx, w } = this.setupCanvas(id, rows * rowH + 10);
    const max = Math.max(...items.map(i => i.value), 1);
    const lw = 110, bw = w - lw - 60;
    items.forEach((it, i) => {
      const y = i * rowH + 8;
      ctx.fillStyle = this.cssVar('--text2'); ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(it.label.length > 9 ? it.label.slice(0, 8) + '…' : it.label, lw - 8, y + 14);
      ctx.fillStyle = this.cssVar('--bg3');
      ctx.beginPath(); ctx.roundRect(lw, y, bw, 18, 9); ctx.fill();
      const g = ctx.createLinearGradient(lw, 0, lw + bw, 0);
      g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#06b6d4');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(lw, y, Math.max(bw * it.value / max, 8), 18, 9); ctx.fill();
      ctx.fillStyle = this.cssVar('--text3'); ctx.textAlign = 'left';
      ctx.fillText(U.fmtNum(it.value), lw + bw + 8, y + 14);
    });
  },

  /* ================= 仪表盘 ================= */
  pDash() {
    const softs = DB.softwares(), users = DB.users(), logs = DB.logs(), cmts = DB.comments();
    const day = 86400000;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayDl = logs.filter(l => l.time >= todayStart.getTime()).length;
    const yesterdayDl = logs.filter(l => l.time >= todayStart.getTime() - day && l.time < todayStart.getTime()).length;
    const pending = softs.filter(s => s.status === 'pending').length;
    const weekUsers = users.filter(u => u.createdAt > Date.now() - 7 * day).length;
    const totalDl = softs.reduce((a, s) => a + s.downloads, 0);

    // 近14天趋势
    const labels = [], data = [];
    for (let d = 13; d >= 0; d--) {
      const start = todayStart.getTime() - d * day;
      labels.push(new Date(start).getDate() + '日');
      data.push(logs.filter(l => l.time >= start && l.time < start + day).length);
    }
    // 分类分布
    const catItems = DB.categories().map(c => ({
      label: c.name, value: softs.filter(s => s.category === c.id && s.status === 'approved').length,
    })).filter(x => x.value > 0);
    // Top5
    const top5 = [...softs].filter(s => s.status === 'approved').sort((a, b) => b.downloads - a.downloads).slice(0, 5)
      .map(s => ({ label: s.name, value: s.downloads }));
    // 最新动态
    const acts = [
      ...logs.slice(-6).map(l => ({ t: l.time, txt: `${l.userId ? (DB.userById(l.userId)?.username || '用户') : '游客'} 下载了 ${DB.softwareById(l.softwareId)?.name || '未知软件'}`, ic: '⬇️' })),
      ...cmts.slice(-4).map(c => ({ t: c.time, txt: `${DB.userById(c.userId)?.username || '用户'} 评论了 ${DB.softwareById(c.softwareId)?.name || ''}`, ic: '💬' })),
      ...softs.filter(s => s.status === 'pending').map(s => ({ t: s.createdAt, txt: `${DB.userById(s.uploaderId)?.username || '用户'} 提交了 ${s.name} 待审核`, ic: '⏳' })),
    ].sort((a, b) => b.t - a.t).slice(0, 9);

    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>📊 仪表盘</h2>
        <div class="right"><span class="hint">数据实时联动前台 · ${U.fmtTime(Date.now())}</span></div>
      </div>
      <div class="stat-grid">
        <div class="card stat-card" style="cursor:pointer" onclick="Admin.go('users')">
          <div class="ic">👥</div><b>${users.length}</b><span>注册用户 · 本周 +${weekUsers}</span>
        </div>
        <div class="card stat-card" style="cursor:pointer" onclick="Admin.go('softs')">
          <div class="ic">📦</div><b>${softs.filter(s => s.status === 'approved').length}</b><span>已上架软件 / 共 ${softs.length}</span>
        </div>
        <div class="card stat-card" style="cursor:pointer" onclick="Admin.go('review')">
          <div class="ic">⏳</div><b style="color:${pending ? 'var(--warn)' : 'inherit'}">${pending}</b><span>待审核软件 ${pending ? '· 点击处理' : ''}</span>
        </div>
        <div class="card stat-card" style="cursor:pointer" onclick="Admin.go('logs')">
          <div class="ic">⬇️</div><b>${todayDl}</b>
          <span>今日下载 · 昨日 ${yesterdayDl}</span>
          <span class="trend" style="color:${todayDl >= yesterdayDl ? 'var(--ok)' : 'var(--err)'}">${todayDl >= yesterdayDl ? '▲' : '▼'} ${yesterdayDl ? Math.abs(Math.round((todayDl - yesterdayDl) / yesterdayDl * 100)) : 100}%</span>
        </div>
        <div class="card stat-card" style="cursor:pointer" onclick="Admin.go('logs')"><div class="ic">🚀</div><b>${U.fmtNum(totalDl)}</b><span>历史累计下载</span></div>
      </div>
      <div class="chart-grid">
        <div class="card chart-card"><h4>📈 近 14 天下载趋势</h4><canvas id="cLine"></canvas></div>
        <div class="card chart-card"><h4>🗂️ 上架软件分类分布</h4><canvas id="cDough"></canvas></div>
      </div>
      <div class="two-col">
        <div class="card chart-card"><h4>🏆 下载量 TOP5</h4><canvas id="cBar"></canvas></div>
        <div class="card chart-card"><h4>🕐 最新动态</h4>
          ${acts.map(a => `<div class="list-row"><span>${a.ic}</span><span style="flex:1;color:var(--text2)">${U.esc(a.txt)}</span><span class="hint">${U.ago(a.t)}</span></div>`).join('') || '<p class="hint">暂无动态</p>'}
        </div>
      </div>`;
    requestAnimationFrame(() => {
      this.lineChart('cLine', labels, data);
      this.doughnut('cDough', catItems);
      this.hbar('cBar', top5);
    });
  },

  /* ================= 审核队列 ================= */
  pReview() {
    const list = DB.softwares().filter(s => s.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>⏳ 审核队列</h2>
        <div class="right"><span class="badge ${list.length ? 'badge-warn' : 'badge-ok'}">${list.length ? list.length + ' 个待处理' : '全部处理完毕 ✓'}</span></div>
      </div>
      ${list.length ? list.map(s => {
        const up = DB.userById(s.uploaderId);
        return `<div class="card" style="padding:20px;margin-bottom:14px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div style="font-size:40px">${s.icon}</div>
          <div style="flex:1;min-width:220px">
            <b style="font-size:16px">${U.esc(s.name)} v${U.esc(s.version)}</b>
            <span class="badge badge-gray" style="margin-left:8px">${DB.categoryById(s.category)?.name || '未分类'}</span>
            <p style="font-size:13px;color:var(--text2);margin:8px 0;line-height:1.6">${U.esc(s.desc)}</p>
            <div class="hint">上传者：${up ? U.esc(up.username) : '未知'} · ${U.fmtTime(s.createdAt)} · ${U.fmtSize(s.size)} · ${s.os.join(' / ')}${s.fileName ? ' · 文件：' + U.esc(s.fileName) : ''}</div>
          </div>
          <div style="display:flex;gap:8px;flex:none">
            <button class="btn btn-sm" onclick="Admin.downloadSoft('${s.id}')">⬇ 下载安装包</button>
            <button class="btn btn-ok btn-sm" onclick="Admin.approve('${s.id}')">✓ 通过上架</button>
            <button class="btn btn-danger btn-sm" onclick="Admin.reject('${s.id}')">✕ 驳回</button>
          </div>
        </div>`;
      }).join('') : '<div class="card empty"><div class="icon">🎉</div>审核队列已清空，暂无待处理的软件</div>'}`;
  },
  approve(id) {
    const softs = DB.softwares();
    const s = softs.find(x => x.id === id);
    s.status = 'approved'; delete s.rejectReason;
    DB.saveSoftwares(softs);
    U.toast(`「${s.name}」已通过审核，前台立即可见`, 'ok');
    this.go('review');
  },
  reject(id) {
    U.prompt('请输入驳回原因（会展示给上传者）：', reason => {
      const softs = DB.softwares();
      const s = softs.find(x => x.id === id);
      s.status = 'rejected'; s.rejectReason = reason || '不符合上架规范';
      DB.saveSoftwares(softs);
      U.toast(`「${s.name}」已驳回`, 'ok');
      this.go('review');
    }, '不符合上架规范');
  },

  /* ================= 软件管理 ================= */
  pSofts() {
    const f = this.filters;
    let list = DB.softwares();
    if (f.softStatus !== 'all') list = list.filter(s => s.status === f.softStatus);
    if (f.softCat !== 'all') list = list.filter(s => s.category === f.softCat);
    if (f.softKw) list = list.filter(s => s.name.toLowerCase().includes(f.softKw));
    list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const sb = s =>
      s.status === 'approved' ? '<span class="badge badge-ok">已上架</span>' :
      s.status === 'pending' ? '<span class="badge badge-warn">待审核</span>' :
      '<span class="badge badge-err">已驳回</span>';

    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>📦 软件管理 <span class="hint">（共 ${list.length} 条）</span></h2>
        <div class="right">
          <input placeholder="🔍 搜索软件名…" value="${U.esc(f.softKw)}" oninput="Admin.filters.softKw=this.value.trim().toLowerCase();Admin.pSofts()" style="width:170px">
          <select onchange="Admin.filters.softCat=this.value;Admin.pSofts()">
            <option value="all">全部分类</option>
            ${DB.categories().map(c => `<option value="${c.id}" ${f.softCat === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}
          </select>
          <select onchange="Admin.filters.softStatus=this.value;Admin.pSofts()">
            ${[['all', '全部状态'], ['approved', '已上架'], ['pending', '待审核'], ['rejected', '已驳回']].map(([v, t]) => `<option value="${v}" ${f.softStatus === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>软件</th><th>分类</th><th>上传者</th><th>状态</th><th>下载</th><th>评分</th><th>发布时间</th><th>操作</th></tr></thead>
        <tbody>${list.map(s => { const cover = U.coverOf(s); return `<tr>
          <td style="cursor:pointer" onclick="Admin.editSoft('${s.id}')">${cover ? `<img class="sc-thumb" src="${cover}" alt="">` : `<span style="font-size:19px;margin-right:8px">${s.icon}</span>`}<b>${U.esc(s.name)}</b> <span class="hint">v${U.esc(s.version)}</span></td>
          <td>${DB.categoryById(s.category)?.name || '—'}</td>
          <td>${U.esc(DB.userById(s.uploaderId)?.username || '—')}</td>
          <td>${sb(s)}</td>
          <td>${U.fmtNum(s.downloads)}</td>
          <td>${s.rating ? s.rating.toFixed(1) + ' ⭐' : '—'}</td>
          <td class="hint">${U.fmtDate(s.createdAt)}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="Admin.downloadSoft('${s.id}')">⬇ 下载</button>
            <button class="btn btn-sm" onclick="Admin.editSoft('${s.id}')">编辑</button>
            ${s.status === 'approved'
              ? `<button class="btn btn-sm" onclick="Admin.toggleSoft('${s.id}','rejected')">下架</button>`
              : `<button class="btn btn-ok btn-sm" onclick="Admin.toggleSoft('${s.id}','approved')">上架</button>`}
            <button class="btn btn-danger btn-sm" onclick="Admin.delSoft('${s.id}')">删除</button>
          </td>
        </tr>`}).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:34px">暂无数据</td></tr>'}</tbody>
      </table></div>`;
  },
  toggleSoft(id, status) {
    const softs = DB.softwares();
    const s = softs.find(x => x.id === id);
    s.status = status;
    if (status === 'rejected') s.rejectReason = '管理员手动下架';
    else delete s.rejectReason;
    DB.saveSoftwares(softs);
    U.toast(status === 'approved' ? '已上架' : '已下架', 'ok');
    this.pSofts(); this.updatePendingBadge();
  },
  delSoft(id) {
    const s = DB.softwareById(id);
    U.confirmBox(`确定删除「${s.name}」？其评论与下载记录将一并删除（数据联动）。`, () => {
      DB.saveSoftwares(DB.softwares().filter(x => x.id !== id));
      DB.saveComments(DB.comments().filter(c => c.softwareId !== id));
      DB.saveLogs(DB.logs().filter(l => l.softwareId !== id));
      U.toast('已删除并清理关联数据', 'ok');
      this.pSofts(); this.updatePendingBadge();
    });
  },
  editSoft(id) {
    const s = DB.softwareById(id);
    this.editState = { images: (s.images || []).map(i => ({ ...i })), coverId: s.coverId || (s.images && s.images[0] ? s.images[0].id : null) };
    this.imgState = this.editState; this.imgMount = 'editImages';
    this.modal(`
      <div class="modal-head"><h3>✏️ 编辑软件</h3><button class="modal-close" onclick="Admin.closeModal()">✕</button></div>
      <div class="form-row">
        <div><label>名称</label><input id="eName" value="${U.esc(s.name)}"></div>
        <div><label>版本</label><input id="eVer" value="${U.esc(s.version)}"></div>
      </div>
      <div class="form-row">
        <div><label>分类</label><select id="eCat">${DB.categories().map(c => `<option value="${c.id}" ${s.category === c.id ? 'selected' : ''}>${U.esc(c.name)}</option>`).join('')}</select></div>
        <div><label>图标（可选 Emoji）</label><input id="eIcon" value="${U.esc(s.icon)}" maxlength="4"></div>
      </div>
      <label>简介</label><textarea id="eDesc" rows="3">${U.esc(s.desc)}</textarea>
      <label>标签（逗号分隔）</label><input id="eTags" value="${U.esc((s.tags || []).join(', '))}">
      <div class="form-row">
        <div><label>下载量</label><input id="eDl" type="number" value="${s.downloads}"></div>
        <div><label>评分（0-5）</label><input id="eRate" type="number" step="0.1" min="0" max="5" value="${s.rating}"></div>
      </div>
      <label>软件图片（至少 1 张，可设首图）</label>
      <div id="editImages"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="Admin.saveSoft('${s.id}')">保存修改</button>`);
    U.renderImageUploader('editImages', this.editState, this, 'Admin');
  },
  /* 后台图片管理（编辑软件 / 后台上传共用，由 imgState/imgMount 决定目标） */
  addImageFiles(files) {
    const state = this.imgState || this.editState, mount = this.imgMount || 'editImages';
    const arr = [...files].filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    arr.forEach(file => U.compressImage(file).then(data => {
      const id = 'i_' + DB.uid();
      state.images.push({ id, data });
      if (!state.coverId) state.coverId = id;
      U.renderImageUploader(mount, state, this, 'Admin');
    }));
  },
  setCover(id) { const state = this.imgState || this.editState, mount = this.imgMount || 'editImages'; state.coverId = id; U.renderImageUploader(mount, state, this, 'Admin'); },
  removeImage(id) {
    const state = this.imgState || this.editState, mount = this.imgMount || 'editImages';
    state.images = state.images.filter(x => x.id !== id);
    if (state.coverId === id) state.coverId = state.images[0] ? state.images[0].id : null;
    U.renderImageUploader(mount, state, this, 'Admin');
  },
  saveSoft(id) {
    const softs = DB.softwares();
    const s = softs.find(x => x.id === id);
    s.name = document.getElementById('eName').value.trim() || s.name;
    s.version = document.getElementById('eVer').value.trim() || s.version;
    s.category = document.getElementById('eCat').value;
    s.icon = document.getElementById('eIcon').value.trim() || '📦';
    s.desc = document.getElementById('eDesc').value.trim();
    s.tags = document.getElementById('eTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    s.downloads = Math.max(0, parseInt(document.getElementById('eDl').value) || 0);
    s.rating = Math.min(5, Math.max(0, parseFloat(document.getElementById('eRate').value) || 0));
    if (!this.editState.images.length) { U.toast('请至少保留一张软件图片', 'err'); return; }
    s.images = this.editState.images;
    s.coverId = this.editState.coverId;
    DB.saveSoftwares(softs);
    this.closeModal();
    U.toast('已保存', 'ok');
    this.pSofts();
  },

  /* ================= 用户管理 ================= */
  pUsers() {
    const kw = this.filters.userKw;
    let list = DB.users();
    if (kw) list = list.filter(u => (u.username + u.email).toLowerCase().includes(kw));
    list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const softs = DB.softwares(), logs = DB.logs();

    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>👥 用户管理 <span class="hint">（共 ${list.length} 人）</span></h2>
        <div class="right">
          <input placeholder="🔍 搜索用户名 / 邮箱…" value="${U.esc(kw)}" oninput="Admin.filters.userKw=this.value.trim().toLowerCase();Admin.pUsers()" style="width:200px">
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>用户</th><th>邮箱</th><th>角色</th><th>状态</th><th>上传数</th><th>下载数</th><th>注册时间</th><th>最近登录</th><th>操作</th></tr></thead>
        <tbody>${list.map(u => {
          const ups = softs.filter(s => s.uploaderId === u.id).length;
          const dls = logs.filter(l => l.userId === u.id).length;
          return `<tr>
            <td><span class="avatar" style="background:${u.color};width:26px;height:26px;font-size:12px;margin-right:8px;vertical-align:middle">${U.esc(u.username[0].toUpperCase())}</span><b>${U.esc(u.username)}</b></td>
            <td class="hint">${U.esc(u.email)}</td>
            <td>${u.role === 'admin' ? '<span class="badge badge-info">管理员</span>' : '<span class="badge badge-gray">普通用户</span>'}</td>
            <td>${u.status === 'active' ? '<span class="badge badge-ok">正常</span>' : '<span class="badge badge-err">已封禁</span>'}</td>
            <td><a href="javascript:void(0)" onclick="Admin.userDetail('${u.id}')">${ups}</a></td>
            <td>${dls}</td>
            <td class="hint">${U.fmtDate(u.createdAt)}</td>
            <td class="hint">${u.lastLogin ? U.ago(u.lastLogin) : '—'}</td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="Admin.userDetail('${u.id}')">详情</button>
              ${u.id !== 'u_admin' ? `
                ${u.status === 'active'
                  ? `<button class="btn btn-danger btn-sm" onclick="Admin.banUser('${u.id}',true)">封禁</button>`
                  : `<button class="btn btn-ok btn-sm" onclick="Admin.banUser('${u.id}',false)">解封</button>`}
                <button class="btn btn-sm" onclick="Admin.toggleRole('${u.id}')">${u.role === 'admin' ? '降为用户' : '设为管理'}</button>
                <button class="btn btn-sm" onclick="Admin.resetPwd('${u.id}')">重置密码</button>
                <button class="btn btn-danger btn-sm" onclick="Admin.delUser('${u.id}')">删除</button>` : '<span class="hint">超级管理员</span>'}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  },
  banUser(id, ban) {
    const users = DB.users();
    const u = users.find(x => x.id === id);
    u.status = ban ? 'banned' : 'active';
    DB.saveUsers(users);
    if (ban && DB.read('session', null) === id) DB.logout();
    U.toast(`已${ban ? '封禁' : '解封'} ${u.username}${ban ? '（该用户将无法登录/上传）' : ''}`, 'ok');
    this.pUsers();
  },
  toggleRole(id) {
    const users = DB.users();
    const u = users.find(x => x.id === id);
    u.role = u.role === 'admin' ? 'user' : 'admin';
    DB.saveUsers(users);
    U.toast(`${u.username} 已${u.role === 'admin' ? '升级为管理员' : '降为普通用户'}`, 'ok');
    this.pUsers();
  },
  resetPwd(id) {
    const u = DB.userById(id);
    U.prompt(`为 ${u.username} 设置新密码：`, np => {
      if (!np || np.length < 6) { U.toast('密码至少 6 位', 'err'); return; }
      const users = DB.users();
      users.find(x => x.id === id).password = np;
      DB.saveUsers(users);
      U.toast('密码已重置', 'ok');
    }, '123456');
  },
  delUser(id) {
    const u = DB.userById(id);
    U.confirmBox(`确定删除用户「${u.username}」？其上传的软件、评论、下载记录将一并删除（数据联动）。`, () => {
      const softIds = DB.softwares().filter(s => s.uploaderId === id).map(s => s.id);
      DB.saveUsers(DB.users().filter(x => x.id !== id));
      DB.saveSoftwares(DB.softwares().filter(s => s.uploaderId !== id));
      DB.saveComments(DB.comments().filter(c => c.userId !== id && !softIds.includes(c.softwareId)));
      DB.saveLogs(DB.logs().filter(l => l.userId !== id && !softIds.includes(l.softwareId)));
      U.toast('用户及关联数据已删除', 'ok');
      this.pUsers(); this.updatePendingBadge();
    });
  },
  userDetail(id) {
    const u = DB.userById(id);
    if (!u) return;
    const ups = DB.softwares().filter(s => s.uploaderId === id);
    const dls = DB.logs().filter(l => l.userId === id);
    const cms = DB.comments().filter(c => c.userId === id);
    this.modal(`
      <div class="modal-head"><h3>👤 用户详情</h3><button class="modal-close" onclick="Admin.closeModal()">✕</button></div>
      <div style="display:flex;align-items:center;gap:14px;margin:12px 0 18px">
        <span class="avatar" style="width:54px;height:54px;font-size:23px;border-radius:15px;background:${u.color}">${U.esc(u.username[0].toUpperCase())}</span>
        <div>
          <b style="font-size:17px">${U.esc(u.username)}</b>
          ${u.role === 'admin' ? '<span class="badge badge-info" style="margin-left:6px">管理员</span>' : ''}
          ${u.status === 'banned' ? '<span class="badge badge-err" style="margin-left:6px">已封禁</span>' : ''}
          <div class="hint">${U.esc(u.email)} · 注册于 ${U.fmtDate(u.createdAt)} · 最近登录 ${u.lastLogin ? U.ago(u.lastLogin) : '—'}</div>
        </div>
      </div>
      <div class="detail-stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="dstat"><b>${ups.length}</b><span>上传软件</span></div>
        <div class="dstat"><b>${dls.length}</b><span>下载次数</span></div>
        <div class="dstat"><b>${cms.length}</b><span>发表评论</span></div>
      </div>
      <h4 style="margin:10px 0 8px;font-size:14px">上传的软件</h4>
      <div style="max-height:200px;overflow-y:auto">
        ${ups.length ? ups.map(s => { const cover = U.coverOf(s); return `<div class="list-row" style="cursor:pointer" onclick="Admin.closeModal();Admin.editSoft('${s.id}')"><span>${cover ? `<img class="sc-thumb" src="${cover}" alt="">` : s.icon}</span>
          <span style="flex:1">${U.esc(s.name)} v${U.esc(s.version)}</span>
          <span class="badge ${s.status === 'approved' ? 'badge-ok' : s.status === 'pending' ? 'badge-warn' : 'badge-err'}">${s.status === 'approved' ? '已上架' : s.status === 'pending' ? '待审核' : '已驳回'}</span>
          <span class="hint">⬇ ${U.fmtNum(s.downloads)}</span>
          <button class="btn btn-sm" onclick="event.stopPropagation();Admin.downloadSoft('${s.id}')">⬇ 下载</button></div>`; }).join('') : '<p class="hint">暂无上传</p>'}
      </div>`);
  },

  /* ================= 评论管理 ================= */
  pCmts() {
    const f = this.filters.cmtStatus;
    let list = DB.comments();
    if (f !== 'all') list = list.filter(c => c.status === f);
    list = [...list].sort((a, b) => b.time - a.time);
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>💬 评论管理 <span class="hint">（共 ${list.length} 条）</span></h2>
        <div class="right">
          <select onchange="Admin.filters.cmtStatus=this.value;Admin.pCmts()">
            ${[['all', '全部'], ['visible', '显示中'], ['hidden', '已隐藏']].map(([v, t]) => `<option value="${v}" ${f === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>用户</th><th>所属软件</th><th style="white-space:normal">评论内容</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${list.map(c => {
          const cu = DB.userById(c.userId), s = DB.softwareById(c.softwareId);
          return `<tr>
            <td><b>${cu ? U.esc(cu.username) : '已注销'}</b></td>
            <td>${s ? s.icon + ' ' + U.esc(s.name) : '已删除软件'}</td>
            <td style="white-space:normal;max-width:340px">${U.esc(c.content)}</td>
            <td class="hint">${U.ago(c.time)}</td>
            <td>${c.status === 'visible' ? '<span class="badge badge-ok">显示中</span>' : '<span class="badge badge-gray">已隐藏</span>'}</td>
            <td style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="Admin.toggleCmt('${c.id}')">${c.status === 'visible' ? '隐藏' : '恢复'}</button>
              <button class="btn btn-danger btn-sm" onclick="Admin.delCmt('${c.id}')">删除</button>
            </td>
          </tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:34px">暂无评论</td></tr>'}</tbody>
      </table></div>`;
  },
  toggleCmt(id) {
    const list = DB.comments();
    const c = list.find(x => x.id === id);
    c.status = c.status === 'visible' ? 'hidden' : 'visible';
    DB.saveComments(list);
    U.toast(c.status === 'visible' ? '已恢复显示' : '已隐藏（前台立即生效）', 'ok');
    this.pCmts();
  },
  delCmt(id) {
    U.confirmBox('确定删除这条评论？', () => {
      DB.saveComments(DB.comments().filter(c => c.id !== id));
      U.toast('已删除', 'ok');
      this.pCmts();
    });
  },

  /* ================= 分类管理 ================= */
  pCats() {
    const cats = DB.categories(), softs = DB.softwares();
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>🗂️ 分类管理</h2>
        <div class="right"><button class="btn btn-primary" onclick="Admin.addCat()">＋ 新增分类</button></div>
      </div>
      <div class="stat-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
        ${cats.map(c => {
          const n = softs.filter(s => s.category === c.id).length;
          return `<div class="card stat-card" style="cursor:pointer" onclick="Admin.viewCat('${c.id}')">
            <div class="ic">${c.icon}</div>
            <b style="font-size:18px">${U.esc(c.name)}</b>
            <span>${n} 款软件 · 点击查看列表</span>
            <div style="display:flex;gap:8px;margin-top:12px" onclick="event.stopPropagation()">
              <button class="btn btn-sm" onclick="Admin.renameCat('${c.id}')">重命名</button>
              <button class="btn btn-danger btn-sm" onclick="Admin.delCat('${c.id}')">删除</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="hint" style="margin-top:14px">💡 点击分类卡片即可查看该分类下的全部软件（含审核状态，可编辑/删除）。</p>`;
  },
  /* 查看某分类下的全部软件 */
  viewCat(id) {
    const c = DB.categoryById(id);
    if (!c) return;
    const list = DB.softwares().filter(s => s.category === id).sort((a, b) => b.createdAt - a.createdAt);
    const sb = s =>
      s.status === 'approved' ? '<span class="badge badge-ok">已上架</span>' :
      s.status === 'pending' ? '<span class="badge badge-warn">待审核</span>' :
      '<span class="badge badge-err">已驳回</span>';
    this.modal(`
      <div class="modal-head"><h3>${c.icon} ${U.esc(c.name)} · 共 ${list.length} 款软件</h3><button class="modal-close" onclick="Admin.closeModal()">✕</button></div>
      <div style="max-height:62vh;overflow-y:auto">
        ${list.length ? list.map(s => `<div class="list-row">
          <span style="font-size:22px">${s.icon}</span>
          <div style="flex:1;min-width:0">
            <b>${U.esc(s.name)}</b> <span class="hint">v${U.esc(s.version)}</span>
            <div class="hint">⬇ ${U.fmtNum(s.downloads)} · 👁 ${U.fmtNum(s.views || 0)} · ${U.fmtDate(s.createdAt)}</div>
          </div>
          ${sb(s)}
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="Admin.downloadSoft('${s.id}')">⬇ 下载</button>
            <button class="btn btn-sm" onclick="Admin.closeModal();Admin.editSoft('${s.id}')">编辑</button>
            <button class="btn btn-danger btn-sm" onclick="Admin.closeModal();Admin.delSoft('${s.id}')">删除</button>
          </div>
        </div>`).join('') : '<p class="hint" style="padding:24px;text-align:center">该分类下暂无软件</p>'}
      </div>
      <div class="divider"></div>
      <p class="hint">提示：删除分类前需先清空其下软件；前台分类筛选栏与本数据实时联动。</p>`);
  },
  addCat() {
    U.prompt('分类名称：', name => {
      if (!name || !name.trim()) return;
      U.prompt('分类图标（Emoji）：', icon => {
        const cats = DB.categories();
        cats.push({ id: 'cat_' + DB.uid(), name: name.trim(), icon: (icon || '📁').trim() });
        DB.saveCategories(cats);
        U.toast('分类已添加，前台筛选栏同步更新', 'ok');
        this.pCats();
      }, '📁');
    });
  },
  renameCat(id) {
    const cats = DB.categories();
    const c = cats.find(x => x.id === id);
    U.prompt('新的分类名称：', name => {
      if (!name || !name.trim()) return;
      c.name = name.trim();
      DB.saveCategories(cats);
      U.toast('已重命名', 'ok');
      this.pCats();
    }, c.name);
  },
  delCat(id) {
    const n = DB.softwares().filter(s => s.category === id).length;
    if (n > 0) { U.toast(`该分类下还有 ${n} 款软件，请先移动或删除它们`, 'err'); return; }
    U.confirmBox('确定删除该分类？', () => {
      DB.saveCategories(DB.categories().filter(c => c.id !== id));
      U.toast('已删除', 'ok');
      this.pCats();
    });
  },

  /* ================= 下载记录 ================= */
  pLogs() {
    const f = this.filters.logSoft;
    let list = DB.logs();
    if (f !== 'all') list = list.filter(l => l.softwareId === f);
    list = [...list].sort((a, b) => b.time - a.time).slice(0, 200);
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>⬇️ 下载记录 <span class="hint">（共 ${DB.logs().length} 条，展示最近 200 条）</span></h2>
        <div class="right">
          <select onchange="Admin.filters.logSoft=this.value;Admin.pLogs()">
            <option value="all">全部软件</option>
            ${DB.softwares().map(s => `<option value="${s.id}" ${f === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
          </select>
          <button class="btn btn-danger" onclick="Admin.clearLogs()">清空记录</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>软件</th><th>下载者</th><th>IP</th><th>时间</th></tr></thead>
        <tbody>${list.map((l, i) => {
          const s = DB.softwareById(l.softwareId), u = l.userId ? DB.userById(l.userId) : null;
          return `<tr>
            <td class="hint">${i + 1}</td>
            <td style="cursor:pointer;color:var(--primary)" onclick="Admin.filterLogBySoft('${l.softwareId}')">${s ? s.icon + ' ' + U.esc(s.name) : '已删除软件'}</td>
            <td>${u ? '<b>' + U.esc(u.username) + '</b>' : '<span class="badge badge-gray">游客</span>'}</td>
            <td class="hint">${l.ip}</td>
            <td class="hint">${U.fmtTime(l.time)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:34px">暂无记录</td></tr>'}</tbody>
      </table></div>`;
  },
  clearLogs() {
    U.confirmBox('确定清空所有下载记录？（不影响软件累计下载量）', () => {
      DB.saveLogs([]);
      U.toast('已清空', 'ok');
      this.pLogs();
    });
  },
  filterLogBySoft(id) {
    this.filters.logSoft = id;
    this.go('logs');
    U.toast('已按该软件筛选下载记录', 'ok');
  },

  /* ================= 公告管理 ================= */
  pAnnos() {
    const list = [...DB.announcements()].sort((a, b) => b.createdAt - a.createdAt);
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>📣 公告管理</h2>
        <div class="right"><button class="btn btn-primary" onclick="Admin.editAnno('')">＋ 发布公告</button></div>
      </div>
      ${list.map(a => `<div class="card" style="padding:18px;margin-bottom:12px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <b>${U.esc(a.title)}</b> ${a.enabled ? '<span class="badge badge-ok">展示中</span>' : '<span class="badge badge-gray">已停用</span>'}
          <p style="font-size:13px;color:var(--text2);margin-top:6px">${U.esc(a.content)}</p>
          <div class="hint" style="margin-top:4px">${U.fmtTime(a.createdAt)}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="Admin.toggleAnno('${a.id}')">${a.enabled ? '停用' : '启用'}</button>
          <button class="btn btn-sm" onclick="Admin.editAnno('${a.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="Admin.delAnno('${a.id}')">删除</button>
        </div>
      </div>`).join('') || '<div class="card empty"><div class="icon">📭</div>暂无公告</div>'}
      <p class="hint">提示：前台首页仅展示最新一条「启用中」的公告。</p>`;
  },
  editAnno(id) {
    const a = id ? DB.announcements().find(x => x.id === id) : { title: '', content: '' };
    this.modal(`
      <div class="modal-head"><h3>${id ? '✏️ 编辑公告' : '📣 发布公告'}</h3><button class="modal-close" onclick="Admin.closeModal()">✕</button></div>
      <label>标题</label><input id="anTitle" value="${U.esc(a.title)}">
      <label>内容</label><textarea id="anContent" rows="3">${U.esc(a.content)}</textarea>
      <button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="Admin.saveAnno('${id}')">保存并启用</button>`);
  },
  saveAnno(id) {
    const title = document.getElementById('anTitle').value.trim();
    const content = document.getElementById('anContent').value.trim();
    if (!title) { U.toast('请填写标题', 'err'); return; }
    const list = DB.announcements();
    if (id) {
      const a = list.find(x => x.id === id);
      a.title = title; a.content = content; a.enabled = true;
    } else {
      list.forEach(x => x.enabled = false);
      list.push({ id: 'a_' + DB.uid(), title, content, enabled: true, createdAt: Date.now() });
    }
    DB.saveAnnouncements(list);
    this.closeModal();
    U.toast('公告已保存，前台首页立即展示', 'ok');
    this.pAnnos();
  },
  toggleAnno(id) {
    const list = DB.announcements();
    const a = list.find(x => x.id === id);
    a.enabled = !a.enabled;
    if (a.enabled) list.forEach(x => { if (x.id !== id) x.enabled = false; });
    DB.saveAnnouncements(list);
    this.pAnnos();
  },
  delAnno(id) {
    U.confirmBox('确定删除该公告？', () => {
      DB.saveAnnouncements(DB.announcements().filter(a => a.id !== id));
      this.pAnnos();
    });
  },

  /* ================= 站点设置 ================= */
  pSet() {
    const st = DB.settings();
    const sw = (key, label, desc) => `
      <div class="list-row" style="padding:14px 0">
        <div style="flex:1"><b style="font-size:14px">${label}</b><div class="hint">${desc}</div></div>
        <label style="margin:0;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="st_${key}" ${st[key] ? 'checked' : ''} style="width:18px;height:18px">
        </label>
      </div>`;
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>⚙️ 站点设置</h2></div>
      <div class="two-col">
        <div class="card" style="padding:24px">
          <h4 style="margin-bottom:6px">基础信息</h4>
          <label>站点名称</label><input id="st_siteName" value="${U.esc(st.siteName || '')}">
          <label>站点标语</label><input id="st_siteSlogan" value="${U.esc(st.siteSlogan || '')}">
          <label>上传大小上限（MB）</label><input id="st_maxUploadMB" type="number" value="${st.maxUploadMB || 2048}">
        </div>
        <div class="card" style="padding:24px">
          <h4 style="margin-bottom:6px">功能开关（与前台实时联动）</h4>
          ${sw('requireReview', '上传需要审核', '开启后用户上传的软件需管理员审核才会公开')}
          ${sw('allowRegister', '开放注册', '关闭后前台无法注册新账户')}
          ${sw('allowComment', '开放评论', '关闭后前台隐藏评论输入框')}
          ${sw('maintenance', '维护模式', '开启后前台显示维护页面（后台不受影响）')}
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:18px">
        <button class="btn btn-primary" onclick="Admin.saveSet()">💾 保存设置</button>
        <button class="btn btn-danger" onclick="U.confirmBox('确定重置所有演示数据？当前全部修改都会丢失！',()=>{DB.reset().then(()=>location.reload())})">♻️ 重置演示数据</button>
      </div>`;
  },
  saveSet() {
    const st = DB.settings();
    st.siteName = document.getElementById('st_siteName').value.trim() || 'SoftHub';
    st.siteSlogan = document.getElementById('st_siteSlogan').value.trim();
    st.maxUploadMB = Math.max(1, parseInt(document.getElementById('st_maxUploadMB').value) || 2048);
    ['requireReview', 'allowRegister', 'allowComment', 'maintenance'].forEach(k => {
      st[k] = document.getElementById('st_' + k).checked;
    });
    DB.saveSettings(st);
    U.toast('设置已保存，前台立即生效', 'ok');
    this.renderLayout();
    this.go('set');
  },

  /* ================= 硬件 / 系统信息 ================= */
  pSys() {
    const nav = navigator, ua = nav.userAgent;
    let browser = '未知';
    if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
    else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'Opera';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';
    let os = '未知';
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/(iPhone|iPad|iPod)/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; }
    const mb = bytes / 1048576;
    const mem = nav.deviceMemory ? nav.deviceMemory + ' GB' : '未暴露';
    const cores = nav.hardwareConcurrency || '未暴露';
    const curTheme = document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const rows = [
      ['🌐 浏览器', browser], ['🖥️ 操作系统', os],
      ['📱 设备类型', isMobile ? '移动设备' : '桌面设备'],
      ['🧭 内核标识 (UA)', ua], ['🌍 语言', nav.language + (nav.languages && nav.languages.length ? '（' + nav.languages.join(', ') + '）' : '')],
      ['🖥️ 屏幕分辨率', screen.width + ' × ' + screen.height + ' px'],
      ['🪟 视口大小', window.innerWidth + ' × ' + window.innerHeight + ' px'],
      ['🔍 设备像素比', (window.devicePixelRatio || 1) + 'x'],
      ['⚙️ CPU 逻辑核心', cores + ' 核'], ['💾 设备内存', mem],
      ['🔌 网络状态', nav.onLine ? '在线' : '离线'], ['🍪 Cookie', nav.cookieEnabled ? '启用' : '禁用'],
      ['🎨 当前主题', curTheme === 'dark' ? '深色' : '浅色'],
      ['💽 本地存储占用', (mb >= 0.01 ? mb.toFixed(2) + ' MB' : Math.round(bytes) + ' 字节') + ' / ' + localStorage.length + ' 项'],
      ['⏰ 当前时间', new Date().toLocaleString()],
    ];
    const card = arr => `<div class="card" style="padding:6px 4px"><div class="sys-rows">${arr.map(([k, v]) => `<div class="sys-row"><span>${k}</span><b>${U.esc(String(v))}</b></div>`).join('')}</div></div>`;
    const half = Math.ceil(rows.length / 2);
    document.getElementById('mainBox').innerHTML = `
      <div class="page-head"><h2>💻 硬件 / 系统信息</h2>
        <div class="right"><button class="btn" onclick="Admin.pSys()">🔄 刷新</button></div>
      </div>
      <p class="hint" style="margin-bottom:16px">以下为<span style="color:var(--primary);font-weight:600">当前浏览器 / 设备</span>的运行环境信息。部署到服务器后，可在此查看访问端真实环境画像；服务器自身硬件指标由后端接口提供。</p>
      <div class="two-col">${card(rows.slice(0, half))}${card(rows.slice(half))}</div>`;
  },
};

DB.init().then(() => Admin.init());
