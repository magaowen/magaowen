/* =====================================================
 * SoftHub 前台逻辑
 * ===================================================== */
const App = {
  state: { cat: 'all', kw: '', sort: 'hot', uploadFile: null, images: [], coverId: null },

  init() {
    const st = DB.settings();
    document.getElementById('siteName').textContent = st.siteName || 'SoftHub';
    document.title = (st.siteName || 'SoftHub') + ' · 软件分享平台';
    if (st.siteSlogan) {
      document.getElementById('siteSlogan').textContent =
        st.siteSlogan + ' —— 游客可自由浏览下载，注册后即可上传分享';
    }
    if (st.maintenance) {
      document.body.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
        <div style="font-size:60px">🔧</div><h2>站点维护中，请稍后访问</h2>
        <p style="color:var(--text3)">管理员可 <a href="admin.html">进入后台</a> 关闭维护模式</p></div>`;
      return;
    }
    this.renderAuth();
    this.renderStats();
    this.renderAnnounce();
    this.renderChips();
    this.renderGrid();
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('searchInput').addEventListener('input', e => {
      this.state.kw = e.target.value.trim().toLowerCase();
      this.renderGrid();
    });
    document.getElementById('sortSel').addEventListener('change', e => {
      this.state.sort = e.target.value;
      this.renderGrid();
    });
    document.addEventListener('click', e => {
      const menu = document.getElementById('userMenu');
      if (menu && !e.target.closest('.user-chip')) menu.classList.remove('open');
    });
    document.querySelectorAll('.modal-mask').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
    });
  },

  /* ---------- 顶栏登录区 ---------- */
  renderAuth() {
    const box = document.getElementById('authArea');
    const me = DB.session();
    if (!me) {
      box.innerHTML = `
        <button class="btn btn-ghost" onclick="App.openAuth('login')">登录</button>
        <button class="btn btn-primary" onclick="App.openAuth('reg')">注册账户</button>`;
      return;
    }
    box.innerHTML = `
      <div class="user-chip" onclick="document.getElementById('userMenu').classList.toggle('open');event.stopPropagation()">
        <span class="avatar" style="background:${me.color}">${U.esc(me.username[0].toUpperCase())}</span>
        <span class="name">${U.esc(me.username)}</span>
        <span style="color:var(--text3);font-size:11px">▼</span>
        <div class="user-menu" id="userMenu">
          <button onclick="App.openUpload()">📤 上传软件</button>
          <button onclick="App.openMine()">👤 个人中心</button>
          ${me.role === 'admin' ? '<button onclick="location.href=\'admin.html\'">🛠️ 后台管理</button>' : ''}
          <button onclick="App.doLogout()" style="color:var(--err)">🚪 退出登录</button>
        </div>
      </div>`;
  },

  /* ---------- 顶部统计 ---------- */
  renderStats() {
    const softs = DB.softwares().filter(s => s.status === 'approved');
    const totalDl = softs.reduce((a, s) => a + s.downloads, 0);
    const users = DB.users().length;
    document.getElementById('heroStats').innerHTML = `
      <div class="hstat"><b class="grad-text">${softs.length}</b><span>精选软件</span></div>
      <div class="hstat"><b class="grad-text">${U.fmtNum(totalDl)}</b><span>累计下载</span></div>
      <div class="hstat"><b class="grad-text">${users}</b><span>注册用户</span></div>
      <div class="hstat"><b class="grad-text">${DB.categories().length}</b><span>软件分类</span></div>`;
  },

  renderAnnounce() {
    const list = DB.announcements().filter(a => a.enabled);
    const bar = document.getElementById('announceBar');
    if (!list.length) { bar.innerHTML = ''; return; }
    const a = list[0];
    bar.innerHTML = `<div class="announce-inner">📣 <b>${U.esc(a.title)}</b> ${U.esc(a.content)}</div>`;
  },

  /* ---------- 分类 chips ---------- */
  renderChips() {
    const cats = DB.categories();
    let html = `<button class="chip ${this.state.cat === 'all' ? 'on' : ''}" onclick="App.setCat('all')">全部</button>`;
    cats.forEach(c => {
      html += `<button class="chip ${this.state.cat === c.id ? 'on' : ''}" onclick="App.setCat('${c.id}')">${c.icon} ${U.esc(c.name)}</button>`;
    });
    document.getElementById('catChips').innerHTML = html;
  },
  setCat(id) { this.state.cat = id; this.renderChips(); this.renderGrid(); },

  /* ---------- 软件网格 ---------- */
  renderGrid() {
    let list = DB.softwares().filter(s => s.status === 'approved');
    const { cat, kw, sort } = this.state;
    if (cat !== 'all') list = list.filter(s => s.category === cat);
    if (kw) list = list.filter(s =>
      (s.name + s.desc + (s.tags || []).join(',')).toLowerCase().includes(kw));
    if (sort === 'hot') list.sort((a, b) => b.downloads - a.downloads);
    if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'rate') list.sort((a, b) => b.rating - a.rating);

    const grid = document.getElementById('softGrid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon">🔭</div>没有找到匹配的软件</div>`;
      return;
    }
    grid.innerHTML = list.map(s => {
      const cat = DB.categoryById(s.category);
      const cover = U.coverOf(s);
      return `
      <div class="card soft-card" onclick="App.openDetail('${s.id}')">
        <div class="sc-head">
          <div class="sc-icon ${cover ? 'thumb' : ''}">${cover ? `<img src="${cover}" style="width:54px;height:54px;border-radius:15px;object-fit:cover;display:block" alt="">` : (s.icon || '📦')}</div>
          <div style="min-width:0">
            <div class="sc-title">${U.esc(s.name)} <span class="sc-ver">v${U.esc(s.version)}</span></div>
            <div class="sc-meta">
              <span>${cat ? cat.icon + ' ' + U.esc(cat.name) : ''}</span>
              <span>💾 ${U.fmtSize(s.size)}</span>
            </div>
          </div>
        </div>
        <p class="sc-desc">${U.esc(s.desc)}</p>
        <div class="sc-tags">${(s.tags || []).slice(0, 3).map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>
        <div class="sc-foot">
          <span class="sc-dl">${U.stars(s.rating)} <span style="margin-left:4px">⬇ ${U.fmtNum(s.downloads)}</span></span>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.doDownload('${s.id}')">⬇ 下载</button>
        </div>
      </div>`;
    }).join('');
  },

  /* ---------- 登录 / 注册 ---------- */
  openAuth(mode) {
    this.switchAuth(mode);
    document.getElementById('authModal').classList.add('open');
  },
  switchAuth(mode) {
    const isLogin = mode === 'login';
    if (!isLogin && !DB.settings().allowRegister) { U.toast('站点当前已关闭注册', 'err'); return; }
    document.getElementById('loginForm').style.display = isLogin ? '' : 'none';
    document.getElementById('regForm').style.display = isLogin ? 'none' : '';
    document.getElementById('authTitle').textContent = isLogin ? '👋 欢迎回来' : '🚀 创建账户';
    document.getElementById('authHint').textContent = isLogin ? '登录后即可上传软件、发表评论' : '注册即可上传分享你的软件（浏览下载无需注册）';
  },
  async doLogin() {
    const name = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const me = await DB.login(name, pass);
    if (!me) return;
    if (me.status === 'banned') { U.toast('该账户已被封禁，请联系管理员', 'err'); DB.logout(); return; }
    this.close('authModal');
    this.renderAuth();
    U.toast('欢迎回来，' + me.username + '！', 'ok');
  },
  async doRegister() {
    if (!DB.settings().allowRegister) { U.toast('站点当前已关闭注册', 'err'); return; }
    const name = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPass2').value;
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) { U.toast('用户名需为 3-16 位字母/数字/下划线', 'err'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { U.toast('邮箱格式不正确', 'err'); return; }
    if (pass.length < 6) { U.toast('密码至少 6 位', 'err'); return; }
    if (pass !== pass2) { U.toast('两次密码不一致', 'err'); return; }
    const me = await DB.register({ username: name, email, password: pass });
    if (!me) return;
    this.close('authModal');
    this.renderAuth();
    this.renderStats();
    U.toast('注册成功，欢迎加入 ' + DB.settings().siteName + '！', 'ok');
  },
  doLogout() {
    DB.logout();
    this.renderAuth();
    U.toast('已退出登录');
  },

  /* ---------- 上传 ---------- */
  openUpload() {
    const me = DB.session();
    if (!me) { U.toast('上传软件需要先登录账户', 'err'); this.openAuth('login'); return; }
    if (me.status === 'banned') { U.toast('账户已被封禁，无法上传', 'err'); return; }
    const sel = document.getElementById('upCat');
    sel.innerHTML = DB.categories().map(c => `<option value="${c.id}">${c.icon} ${U.esc(c.name)}</option>`).join('');
    document.getElementById('uploadHint').textContent = DB.settings().requireReview
      ? '提交后将进入管理员审核队列，审核通过后公开展示'
      : '当前站点无需审核，提交后立即公开展示';
    this.state.images = [];
    this.state.coverId = null;
    U.renderImageUploader('upImages', this.state, this, 'App');
    document.getElementById('uploadModal').classList.add('open');
  },
  /* 图片上传器：添加 / 设首图 / 删除 */
  addImageFiles(files) {
    const arr = [...files].filter(f => f.type.startsWith('image/'));
    if (!arr.length) return;
    let pending = arr.length;
    arr.forEach(file => U.compressImage(file).then(data => {
      const id = 'i_' + DB.uid();
      this.state.images.push({ id, data });
      if (!this.state.coverId) this.state.coverId = id;
      if (--pending === 0) U.renderImageUploader('upImages', this.state, this, 'App');
    }));
  },
  setCover(id) { this.state.coverId = id; U.renderImageUploader('upImages', this.state, this, 'App'); },
  removeImage(id) {
    this.state.images = this.state.images.filter(x => x.id !== id);
    if (this.state.coverId === id) this.state.coverId = this.state.images[0] ? this.state.images[0].id : null;
    U.renderImageUploader('upImages', this.state, this, 'App');
  },
  doUpload() {
    const me = DB.session();
    if (!me) { this.openAuth('login'); return; }
    const name = document.getElementById('upName').value.trim();
    const ver = document.getElementById('upVer').value.trim();
    const cat = document.getElementById('upCat').value;
    const icon = document.getElementById('upIcon').value.trim() || '📦';
    const desc = document.getElementById('upDesc').value.trim();
    const tags = document.getElementById('upTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    const os = [...document.querySelectorAll('.upOs:checked')].map(c => c.value);
    const link = document.getElementById('upLink').value.trim();
    if (!name || !ver || !desc) { U.toast('请填写名称、版本和简介', 'err'); return; }
    if (!os.length) { U.toast('请至少选择一个支持平台', 'err'); return; }
    if (!link) { U.toast('请填写下载链接', 'err'); return; }
    if (!/^https?:\/\//i.test(link)) { U.toast('下载链接需以 http(s):// 开头', 'err'); return; }
    if (!this.state.images.length) { U.toast('请至少上传一张软件图片', 'err'); return; }

    const softs = DB.softwares();
    const s = {
      id: 's_' + DB.uid(), name, version: ver, category: cat, icon, os,
      size: 0, desc, tags, uploaderId: me.id,
      status: DB.settings().requireReview ? 'pending' : 'approved',
      downloads: 0, views: 0, rating: 0, ratingCount: 0,
      createdAt: Date.now(), homepage: '', fileName: '', fileData: '',
      downloadUrl: link,
      images: this.state.images, coverId: this.state.coverId,
    };
    softs.push(s);
    DB.saveSoftwares(softs);
    this.close('uploadModal');
    ['upName', 'upVer', 'upIcon', 'upDesc', 'upTags', 'upLink'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    this.renderGrid(); this.renderStats();
    U.toast(s.status === 'pending' ? '提交成功，等待管理员审核 ⏳' : '发布成功！', 'ok');
  },

  /* ---------- 下载（无需登录） ---------- */
  doDownload(id) {
    const softs = DB.softwares();
    const s = softs.find(x => x.id === id);
    if (!s) return;
    if (DB.settings().maintenance && !(DB.session() && DB.session().role === 'admin')) { U.toast('站点维护中，暂不可下载', 'err'); return; }
    s.downloads = (s.downloads || 0) + 1;
    DB.saveSoftwares(softs);
    const logs = DB.logs();
    logs.push({ id: 'l_' + DB.uid(), softwareId: id, userId: (DB.session() && DB.session().id) || null, time: Date.now(), ip: '' });
    DB.saveLogs(logs);
    const url = s.downloadUrl || s.link;
    if (url) {
      window.open(url, '_blank', 'noopener');
      U.toast(`开始下载 ${s.name}`, 'ok');
    } else if (s.fileData) {
      if (DB.mode === 'remote') window.open('/api/softwares/' + id + '/file', '_blank', 'noopener');
      else U.downloadSoftFile(s);
      U.toast(`开始下载 ${s.name}`, 'ok');
    } else {
      U.toast('该软件暂未提供下载链接或安装包', 'err');
    }
    this.renderGrid(); this.renderStats();
    const open = document.getElementById('detailModal').classList.contains('open');
    if (open) this.openDetail(id, true);
  },

  /* ---------- 详情 ---------- */
  openDetail(id, keepView) {
    const softs = DB.softwares();
    const s = softs.find(x => x.id === id);
    if (!s) return;
    if (!keepView) { s.views++; DB.saveSoftwares(softs); }
    const cat = DB.categoryById(s.category);
    const up = DB.userById(s.uploaderId);
    const me = DB.session();
    const comments = DB.comments()
      .filter(c => c.softwareId === id && c.status === 'visible')
      .sort((a, b) => b.time - a.time);
    const allowComment = DB.settings().allowComment;

    const imgs = s.images || [];
    const cover = U.coverOf(s);
    const gallery = imgs.length
      ? `<div class="gallery" style="margin:8px 0 18px">
          <div class="gallery-main"><img id="detailMain" src="${(imgs.find(i => i.id === s.coverId) || imgs[0]).data}" alt=""></div>
          ${imgs.length > 1 ? `<div class="gallery-thumbs">` + imgs.map(im => `<div class="g-thumb ${im.id === s.coverId ? 'on' : ''}" onclick="document.getElementById('detailMain').src='${im.data}';this.parentNode.querySelectorAll('.g-thumb').forEach(t=>t.classList.remove('on'));this.classList.add('on')"><img src="${im.data}" alt=""></div>`).join('') + `</div>` : ''}
        </div>`
      : (cover ? `<div class="gallery-main" style="margin:8px 0 18px"><img src="${cover}" alt=""></div>` : '');

    document.getElementById('detailBody').innerHTML = `
      <div class="modal-head">
        <h3>软件详情</h3>
        <button class="modal-close" onclick="App.close('detailModal')">✕</button>
      </div>
      ${gallery}
      <div class="detail-head">
        <div class="detail-icon">${cover ? `<img src="${cover}" style="width:84px;height:84px;border-radius:22px;object-fit:cover" alt="">` : (s.icon || '📦')}</div>
        <div style="flex:1;min-width:0">
          <h2 style="font-size:22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${U.esc(s.name)} <span class="badge badge-info">v${U.esc(s.version)}</span>
          </h2>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <span class="badge badge-gray">${cat ? cat.icon + ' ' + U.esc(cat.name) : '未分类'}</span>
            ${s.os.map(o => `<span class="badge badge-gray">${o === 'Windows' ? '🪟' : o === 'macOS' ? '🍎' : '🐧'} ${o}</span>`).join('')}
          </div>
          <div style="margin-top:8px;font-size:12.5px;color:var(--text3)">
            由 <b style="color:var(--text2)">${up ? U.esc(up.username) : '未知用户'}</b> 分享于 ${U.fmtDate(s.createdAt)}
          </div>
        </div>
        <button class="btn btn-primary" style="align-self:center;flex:none" onclick="App.doDownload('${s.id}')">⬇ 立即下载</button>
      </div>
      <div class="detail-stats">
        <div class="dstat"><b>${U.fmtNum(s.downloads)}</b><span>下载量</span></div>
        <div class="dstat"><b>${U.fmtNum(s.views)}</b><span>浏览量</span></div>
        <div class="dstat"><b>${s.rating ? s.rating.toFixed(1) : '—'}</b><span>评分（${s.ratingCount}人）</span></div>
        <div class="dstat"><b>${U.fmtSize(s.size)}</b><span>安装包大小</span></div>
      </div>
      <p style="font-size:14px;line-height:1.8;color:var(--text2)">${U.esc(s.desc)}</p>
      <div class="sc-tags" style="margin-top:12px">${(s.tags || []).map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>
      <div class="divider"></div>
      <h4 style="margin-bottom:6px">💬 用户评论（${comments.length}）</h4>
      ${me && allowComment ? `
        <div style="display:flex;gap:10px;margin:12px 0">
          <input id="cmtInput" placeholder="说说你的使用体验…">
          <button class="btn btn-primary btn-sm" style="flex:none" onclick="App.doComment('${s.id}')">发表</button>
        </div>` : `
        <p class="hint" style="margin:10px 0">${!allowComment ? '站点已关闭评论功能' : '登录后可发表评论 <a href="javascript:void(0)" onclick="App.close(\'detailModal\');App.openAuth(\'login\')">去登录</a>'}</p>`}
      <div>${comments.length ? comments.map(c => {
        const cu = DB.userById(c.userId);
        return `<div class="comment-item">
          <span class="avatar" style="background:${cu ? cu.color : '#999'}">${cu ? U.esc(cu.username[0].toUpperCase()) : '?'}</span>
          <div class="comment-body">
            <div class="c-head"><b>${cu ? U.esc(cu.username) : '已注销用户'}</b><span>${U.ago(c.time)}</span></div>
            <p>${U.esc(c.content)}</p>
          </div>
        </div>`;
      }).join('') : '<p class="hint" style="padding:14px 0">暂无评论，来抢沙发～</p>'}</div>`;
    document.getElementById('detailModal').classList.add('open');
  },
  doComment(softId) {
    const me = DB.session();
    if (!me) { this.openAuth('login'); return; }
    const input = document.getElementById('cmtInput');
    const content = input.value.trim();
    if (!content) { U.toast('评论内容不能为空', 'err'); return; }
    const comments = DB.comments();
    comments.push({
      id: 'c_' + DB.uid(), softwareId: softId, userId: me.id,
      content, time: Date.now(), status: 'visible',
    });
    DB.saveComments(comments);
    this.openDetail(softId, true);
    U.toast('评论发表成功', 'ok');
  },

  /* ---------- 个人中心 ---------- */
  openMine(tab = 'up') {
    const me = DB.session();
    if (!me) { this.openAuth('login'); return; }
    const myUps = DB.softwares().filter(s => s.uploaderId === me.id).sort((a, b) => b.createdAt - a.createdAt);
    const myLogs = DB.logs().filter(l => l.userId === me.id).sort((a, b) => b.time - a.time).slice(0, 30);
    const statusBadge = s =>
      s.status === 'approved' ? '<span class="badge badge-ok">已发布</span>' :
      s.status === 'pending' ? '<span class="badge badge-warn">审核中</span>' :
      `<span class="badge badge-err" title="${U.esc(s.rejectReason || '')}">已驳回</span>`;

    let content = '';
    if (tab === 'up') {
      content = myUps.length ? myUps.map(s => {
        const cover = U.coverOf(s);
        return `
        <div class="mine-item">
          <span class="mi-icon">${cover ? `<img src="${cover}" style="width:26px;height:26px;border-radius:8px;object-fit:cover" alt="">` : s.icon}</span>
          <div class="mi-main">
            <b>${U.esc(s.name)} v${U.esc(s.version)}</b>
            <div>⬇ ${U.fmtNum(s.downloads)} · 👁 ${U.fmtNum(s.views)} · ${U.fmtDate(s.createdAt)}${s.status === 'rejected' && s.rejectReason ? ' · 驳回原因：' + U.esc(s.rejectReason) : ''}</div>
          </div>
          ${statusBadge(s)}
          <button class="btn btn-danger btn-sm" onclick="App.deleteMine('${s.id}')">删除</button>
        </div>`}).join('')
        : '<div class="empty"><div class="icon">📭</div>还没有上传过软件</div>';
    } else {
      content = myLogs.length ? myLogs.map(l => {
        const s = DB.softwareById(l.softwareId);
        return `<div class="mine-item">
          <span class="mi-icon">${s ? s.icon : '❓'}</span>
          <div class="mi-main"><b>${s ? U.esc(s.name) : '已删除软件'}</b><div>${U.fmtTime(l.time)}</div></div>
        </div>`;
      }).join('') : '<div class="empty"><div class="icon">📭</div>暂无下载记录</div>';
    }

    document.getElementById('mineBody').innerHTML = `
      <div class="modal-head">
        <h3>👤 个人中心</h3>
        <button class="modal-close" onclick="App.close('mineModal')">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:10px">
        <span class="avatar" style="width:52px;height:52px;font-size:22px;border-radius:15px;background:${me.color}">${U.esc(me.username[0].toUpperCase())}</span>
        <div>
          <b style="font-size:17px">${U.esc(me.username)}</b>
          ${me.role === 'admin' ? '<span class="badge badge-info" style="margin-left:8px">管理员</span>' : ''}
          <div class="hint">${U.esc(me.email)} · 注册于 ${U.fmtDate(me.createdAt)}</div>
        </div>
      </div>
      <div class="mine-tabs">
        <button class="mine-tab ${tab === 'up' ? 'on' : ''}" onclick="App.openMine('up')">我的上传（${myUps.length}）</button>
        <button class="mine-tab ${tab === 'dl' ? 'on' : ''}" onclick="App.openMine('dl')">下载历史</button>
      </div>
      <div style="max-height:46vh;overflow-y:auto">${content}</div>`;
    document.getElementById('mineModal').classList.add('open');
  },
  deleteMine(id) {
    U.confirmBox('确定删除这个软件吗？相关评论与下载记录会一并清除。', () => {
      DB.saveSoftwares(DB.softwares().filter(s => s.id !== id));
      DB.saveComments(DB.comments().filter(c => c.softwareId !== id));
      DB.saveLogs(DB.logs().filter(l => l.softwareId !== id));
      this.openMine('up');
      this.renderGrid(); this.renderStats();
      U.toast('已删除', 'ok');
    });
  },

  close(id) { document.getElementById(id).classList.remove('open'); },
};

DB.init().then(() => App.init());
