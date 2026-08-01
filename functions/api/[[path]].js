/* =====================================================
 * SoftHub 真实后端 —— Cloudflare Pages Functions
 * 单文件 catch-all 路由，使用 KV 作为数据库。
 * 绑定名：SOFTWARE_HUB_KV
 * ===================================================== */

const KV_KEY = 'SOFTWARE_HUB_KV';
const COOKIE = 'sh_session';

/* ---------- KV 基础读写 ---------- */
// 兼容多种绑定名（代码默认 SOFTWARE_HUB_KV，控制台可能命名为 MY_KV）
const kv = (env) => env[KV_KEY] || env['MY_KV'] || env['SOFTWARE_HUB_KV'];

async function getJSON(env, key, def) {
  const raw = await kv(env).get(key);
  if (raw === null) return def;
  try { return JSON.parse(raw); } catch (e) { return def; }
}
async function setJSON(env, key, val) {
  await kv(env).put(key, JSON.stringify(val));
}

/* ---------- 密码哈希 (PBKDF2) ---------- */
async function hashPw(pw, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pw), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function genSalt() {
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
}
function genId(p) {
  return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function publicUser(u) {
  if (!u) return null;
  const { password, passwordHash, salt, ...rest } = u;
  return rest;
}

/* ---------- 剥离大文件数据（前端列表/bootstrap 不需要安装包本体 & 大图原图） ----------
 * 背景：软件详情图是 base64 内联在 JSON 里的，一张就可能 300KB+。
 * 列表/bootstrap 一次把所有软件的所有大图都吐出来，首屏要等好几秒。
 * 策略：列表只给「缩略图 thumb」，原图 images 留到详情接口按需拉。
 * 兼容老数据：没有 thumb 时，若封面图本身够小（< SMALL_IMG）就直接当缩略图用，
 * 否则列表暂时不给图（前端降级为图标/首字母），管理员点一次「优化图片」即可补齐。 */
const SMALL_IMG = 60 * 1024; // 60KB 以内的图视为「已经足够小」，可直接进列表

function stripHeavy(s) {
  if (!s) return s;
  const { fileData, ...rest } = s;
  // 去掉安装包 base64 本体（列表/bootstrap 不需要）
  rest.fileData = '';
  return rest;
}

/* 列表专用：在 stripHeavy 基础上再剥离 images 原图，只保留 thumb */
function stripForList(s) {
  if (!s) return s;
  const rest = stripHeavy(s);
  const imgs = Array.isArray(rest.images) ? rest.images : [];
  let thumb = rest.thumb || '';
  if (!thumb && imgs.length) {
    const cover = imgs.find(i => i && i.id === rest.coverId) || imgs[0];
    const data = (cover && cover.data) || '';
    if (data && data.length <= SMALL_IMG) thumb = data; // 老数据里的小图，直接复用
  }
  rest.thumb = thumb;
  rest.imageCount = imgs.length;  // 前端据此判断「详情需要按需拉原图」
  rest.images = [];               // 原图不进列表
  return rest;
}

function stripHeavyList(list) {
  return (list || []).map(stripForList);
}

/* ---------- 会话 ---------- */
function readCookie(req) {
  const c = req.headers.get('Cookie') || '';
  const m = c.match(new RegExp(COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}
async function getSessionUser(env, req) {
  const token = readCookie(req);
  if (!token) return null;
  const uid = await kv(env).get('session:' + token);
  if (!uid) return null;
  const users = await getJSON(env, 'users', []);
  const u = users.find(x => x.id === uid);
  return u || null;
}
function sessCookie(token) {
  // 设置或清除会话 cookie（https 站点需 Secure）
  if (token) return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`;
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

/* ---------- 响应辅助 ---------- */
function json(data, status = 200, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
}
function needAuth(user) { return user ? null : json({ error: '请先登录' }, 401); }
function needAdmin(user) { return user && user.role === 'admin' ? null : json({ error: '需要管理员权限' }, 403); }

/* ---------- 种子数据 ---------- */
const DEFAULT_SETTINGS = {
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

// 迁移：已存在但缺新字段的 settings 自动补全，保证老部署拿到新功能默认值
async function migrateSettings(env) {
  const cur = await getJSON(env, 'settings', null);
  if (!cur) return;
  let changed = false;
  const merged = { ...DEFAULT_SETTINGS, ...cur };
  if (!cur.heroTitle) { merged.heroTitle = DEFAULT_SETTINGS.heroTitle; changed = true; }
  if (!cur.business) { merged.business = DEFAULT_SETTINGS.business; changed = true; }
  else {
    if (!cur.business.contacts) { merged.business.contacts = DEFAULT_SETTINGS.business.contacts; changed = true; }
    if (!cur.business.images) { merged.business.images = DEFAULT_SETTINGS.business.images; changed = true; }
  }
  if (changed) await setJSON(env, 'settings', merged);
}

async function ensureSeed(env) {
  const users = await getJSON(env, 'users', []);
  await migrateSettings(env);
  if (users.length) return;
  const now = Date.now();
  const day = 86400000;
  const salt = genSalt();
  const adminHash = await hashPw('admin123', salt);
  const seedUsers = [
    { id: 'u_admin', username: 'admin', passwordHash: adminHash, salt, email: 'admin@softhub.io', role: 'admin', status: 'active', createdAt: now - 90 * day, lastLogin: now - day, color: '#6366f1' },
  ];
  await setJSON(env, 'users', seedUsers);

  const categories = [
    { id: 'dev', name: '开发工具', icon: '⌨️' },
    { id: 'office', name: '效率办公', icon: '📊' },
    { id: 'media', name: '影音媒体', icon: '🎬' },
    { id: 'system', name: '系统工具', icon: '🛠️' },
    { id: 'secure', name: '网络安全', icon: '🛡️' },
    { id: 'design', name: '图形设计', icon: '🎨' },
    { id: 'game', name: '游戏娱乐', icon: '🎮' },
    { id: 'ai', name: 'AI 工具', icon: '🤖' },
  ];
  await setJSON(env, 'categories', categories);

  const softwares = [];
  await setJSON(env, 'softwares', softwares);

  const comments = [];
  await setJSON(env, 'comments', comments);

  const logs = [];
  await setJSON(env, 'logs', logs);

  await setJSON(env, 'announcements', [
    { id: 'a_1', title: '🎉 SoftHub 全新改版上线', content: '全新科技感界面、明暗模式自动切换，欢迎体验并反馈建议！', enabled: true, createdAt: now - 3 * day },
    { id: 'a_2', title: '📢 上传规范提醒', content: '请勿上传含捆绑插件的安装包，审核不通过将被驳回。', enabled: false, createdAt: now - 10 * day },
  ]);
  await setJSON(env, 'settings', { ...DEFAULT_SETTINGS });
}
function mkSoft(id, name, version, category, icon, os, size, desc, tags, uploaderId, status, downloads, views, rating, ratingCount, createdAt, homepage, rejectReason, fileData, fileName) {
  const palettes = [['#6366f1', '#06b6d4'], ['#ec4899', '#8b5cf6'], ['#10b981', '#06b6d4'], ['#f59e0b', '#ef4444'], ['#8b5cf6', '#6366f1'], ['#06b6d4', '#3b82f6'], ['#f43f5e', '#f59e0b'], ['#14b8a6', '#6366f1']];
  const idx = parseInt(id.slice(2)) - 1;
  const [c1, c2] = palettes[idx % palettes.length];
  const data = coverSVG(name, c1, c2);
  return { id, name, version, category, icon, os, size, desc, tags, uploaderId, status, downloads, views, rating, ratingCount, createdAt, homepage, rejectReason: rejectReason || '', fileData: fileData || '', fileName: fileName || '', link: '', images: [{ id: 'i_' + id, data }], coverId: 'i_' + id };
}
function coverSVG(name, c1, c2) {
  const safe = String(name || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='600' height='400' fill='url(#g)'/><circle cx='500' cy='80' r='120' fill='rgba(255,255,255,.12)'/><circle cx='90' cy='340' r='90' fill='rgba(255,255,255,.10)'/><text x='50%' y='54%' font-size='52' fill='rgba(255,255,255,.95)' text-anchor='middle' font-family='sans-serif' font-weight='800'>${safe}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ---------- 主路由 ---------- */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'softwares', ...]
  const seg = parts.slice(1); // 去掉 'api'
  const method = request.method;
  const res = (await ensureSeed(env), await route(env, request, method, seg, url));
  return res;
}

async function route(env, req, method, seg, url) {
  const head = seg[0] || '';
  const me = await getSessionUser(env, req);
  const q = url.searchParams;

  /* ---- 引导：返回全部数据 + 当前会话 ---- */
  if (head === 'bootstrap' && method === 'GET') {
    const [users, softwares, comments, logs, categories, announcements, settings] = await Promise.all([
      getJSON(env, 'users', []), getJSON(env, 'softwares', []), getJSON(env, 'comments', []),
      getJSON(env, 'logs', []), getJSON(env, 'categories', []), getJSON(env, 'announcements', []), getJSON(env, 'settings', {}),
    ]);
    return json({
      me: publicUser(me), users: users.map(publicUser),
      softwares: stripHeavyList(softwares), comments, logs,
      categories, announcements, settings, mode: 'remote',
      build: 'ef9a43b6-fix2',
    });
  }

  /* ---- 认证 ---- */
  if (head === 'auth') {
    const action = seg[1];
    if (action === 'register' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (!await getJSON(env, 'settings', {}).then(s => s.allowRegister !== false)) { /* 默认允许 */ }
      const settings = await getJSON(env, 'settings', {});
      if (settings.allowRegister === false) return json({ error: '站点已关闭注册' }, 403);
      const name = (b.username || '').trim(), email = (b.email || '').trim(), pass = b.password || '';
      if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]{2,16}$/.test(name)) return json({ error: '用户名需为 2-16 位字母、数字、下划线或中文' }, 400);
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: '邮箱格式不正确' }, 400);
      if (pass.length < 6) return json({ error: '密码至少 6 位' }, 400);
      const users = await getJSON(env, 'users', []);
      if (users.some(u => u.username === name)) return json({ error: '用户名已被占用' }, 400);
      if (users.some(u => u.email === email)) return json({ error: '邮箱已被注册' }, 400);
      const salt = genSalt();
      const nu = { id: genId('u_'), username: name, passwordHash: await hashPw(pass, salt), salt, email, role: 'user', status: 'active', createdAt: Date.now(), lastLogin: Date.now(), color: '#6366f1' };
      users.push(nu); await setJSON(env, 'users', users);
      return startSession(env, nu);
    }
    if (action === 'login' && method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const users = await getJSON(env, 'users', []);
      const u = users.find(x => x.username === (b.username || '').trim());
      if (!u) return json({ error: '用户名或密码错误' }, 401);
      if (u.status === 'banned') return json({ error: '该账户已被封禁，请联系管理员' }, 403);
      const h = await hashPw(b.password || '', u.salt || '');
      if (h !== u.passwordHash) return json({ error: '用户名或密码错误' }, 401);
      u.lastLogin = Date.now(); await setJSON(env, 'users', users);
      return startSession(env, u);
    }
    if (action === 'logout' && method === 'POST') {
      const token = readCookie(req);
      if (token) await kv(env).delete('session:' + token);
      return json({ ok: true }, 200, sessCookie(null));
    }
    if (action === 'me' && method === 'GET') return json({ me: publicUser(me) });
  }

  /* ---- 软件 ---- */
  if (head === 'softwares') {
    if (seg.length === 1 && method === 'GET') {
      let list = await getJSON(env, 'softwares', []);
      const cat = q.get('cat'), kw = (q.get('kw') || '').toLowerCase(), sort = q.get('sort') || 'hot';
      const isAdmin = me && me.role === 'admin';
      list = list.filter(s => {
        if (isAdmin) return true;
        if (s.status === 'approved') return true;
        if (me && s.uploaderId === me.id) return true; // 自己的待审/驳回可见
        return false;
      });
      if (cat && cat !== 'all') list = list.filter(s => s.category === cat);
      if (kw) list = list.filter(s => (s.name + s.desc + (s.tags || []).join(' ')).toLowerCase().includes(kw));
      if (sort === 'new') list = list.sort((a, b) => b.createdAt - a.createdAt);
      else list = list.sort((a, b) => b.downloads - a.downloads);
      return json(stripHeavyList(list));
    }
    if (seg.length === 1 && method === 'POST') {
      const err = needAuth(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      if (!b.name || !b.version || !b.desc) return json({ error: '请填写名称、版本和简介' }, 400);
      if (!b.os || !b.os.length) return json({ error: '请至少选择一个支持平台' }, 400);
      if (!b.images || !b.images.length) return json({ error: '请至少上传一张软件图片' }, 400);
      // 下载方式：下载链接 或 安装包，二者至少其一即可（安装包为可选项）
      if (!b.link && !b.fileData) return json({ error: '请填写下载链接，或上传安装包' }, 400);
      const settings = await getJSON(env, 'settings', {});
      const isAdmin = !!(me && me.role === 'admin');
      // 安全：安装包(大文件)仅管理员可存储；普通用户即使前端传了也会被忽略
      const fileData = isAdmin ? (b.fileData || '') : '';
      const fileName = isAdmin ? (b.fileName || '') : '';
      // 管理员直接上传：强制上架（绕过审核开关）；普通用户遵循站点审核设置
      const soft = {
        id: genId('s_'), name: b.name, version: b.version, category: b.category, icon: b.icon || '📦',
        os: b.os, size: b.size || 0, desc: b.desc, tags: b.tags || [], uploaderId: me.id,
        status: isAdmin ? 'approved' : (settings.requireReview ? 'pending' : 'approved'),
        downloads: 0, views: 0, rating: 0, ratingCount: 0, createdAt: Date.now(),
        homepage: b.homepage || '', rejectReason: '', fileData, fileName,
        link: b.link || '', iconImage: b.iconImage || '', images: b.images, coverId: b.coverId || (b.images[0] && b.images[0].id),
        thumb: b.thumb || '',   // 列表卡片用的小缩略图，避免列表接口吐出全部大图
      };
      const list = await getJSON(env, 'softwares', []);
      list.push(soft); await setJSON(env, 'softwares', list);
      return json({ id: soft.id, status: soft.status });
    }
    const id = seg[1];
    if (!id) return json({ error: '缺少 ID' }, 400);
    if (method === 'GET' && seg.length === 2) {
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s) return json({ error: '未找到' }, 404);
      // 默认不返回 fileData（太大）；前端下载时用 ?full=1 按需获取
      return q.get('full') === '1' ? json(s) : json(stripHeavy(s));
    }
    if (seg[2] === 'download' && method === 'POST') {
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s) return json({ error: '未找到' }, 404);
      s.downloads = (s.downloads || 0) + 1;
      await setJSON(env, 'softwares', list);
      const logs = await getJSON(env, 'logs', []);
      logs.push({ id: genId('l_'), softwareId: id, userId: me ? me.id : null, time: Date.now(), ip: req.headers.get('cf-connecting-ip') || '' });
      await setJSON(env, 'logs', logs);
      return json({ downloads: s.downloads });
    }
    if (seg[2] === 'file' && method === 'GET') {
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s || !s.fileData) return json({ error: '无文件' }, 404);
      const comma = s.fileData.indexOf(',');
      const meta = s.fileData.slice(0, comma);
      const bin = s.fileData.slice(comma + 1);
      const mime = /data:(.*?);/.exec(meta);
      const buf = Uint8Array.from(atob(bin), c => c.charCodeAt(0));
      const headers = { 'Content-Type': mime ? mime[1] : 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(s.fileName || (s.name + '-v' + s.version))}"` };
      return new Response(buf, { status: 200, headers });
    }
    if (seg[2] === 'rate' && method === 'POST') {
      const err = needAuth(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      const r = Math.max(0, Math.min(5, parseFloat(b.rating) || 0));
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s) return json({ error: '未找到' }, 404);
      s.rating = (s.rating * s.ratingCount + r) / (s.ratingCount + 1);
      s.ratingCount = (s.ratingCount || 0) + 1;
      await setJSON(env, 'softwares', list);
      return json({ rating: s.rating, ratingCount: s.ratingCount });
    }
    if (method === 'PUT') {
      const err = needAuth(me); if (err) return err;
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s) return json({ error: '未找到' }, 404);
      if (s.uploaderId !== me.id && me.role !== 'admin') return json({ error: '无权修改' }, 403);
      const b = await req.json().catch(() => ({}));
      const allowPkg = me.role === 'admin';
      ['name', 'version', 'category', 'icon', 'os', 'size', 'desc', 'tags', 'homepage', 'link', 'images', 'coverId', 'iconImage', 'thumb'].forEach(k => { if (b[k] !== undefined) s[k] = b[k]; });
      // 安装包仅管理员可改；普通用户即使传了 fileData 也会被忽略
      if (allowPkg) { if (b.fileData !== undefined) s.fileData = b.fileData; if (b.fileName !== undefined) s.fileName = b.fileName; }
      await setJSON(env, 'softwares', list);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const err = needAuth(me); if (err) return err;
      const list = await getJSON(env, 'softwares', []);
      const s = list.find(x => x.id === id);
      if (!s) return json({ error: '未找到' }, 404);
      if (s.uploaderId !== me.id && me.role !== 'admin') return json({ error: '无权删除' }, 403);
      await setJSON(env, 'softwares', list.filter(x => x.id !== id));
      const comments = await getJSON(env, 'comments', []); await setJSON(env, 'comments', comments.filter(c => c.softwareId !== id));
      const logs = await getJSON(env, 'logs', []); await setJSON(env, 'logs', logs.filter(l => l.softwareId !== id));
      return json({ ok: true });
    }
  }

  /* ---- 审核（管理员） ---- */
  if (head === 'review' && method === 'POST') {
    const err = needAdmin(me); if (err) return err;
    const id = seg[1];
    const b = await req.json().catch(() => ({}));
    const list = await getJSON(env, 'softwares', []);
    const s = list.find(x => x.id === id);
    if (!s) return json({ error: '未找到' }, 404);
    if (b.action === 'approve') s.status = 'approved';
    else if (b.action === 'reject') { s.status = 'rejected'; s.rejectReason = b.reason || '不符合上架规范'; }
    else return json({ error: '未知操作' }, 400);
    await setJSON(env, 'softwares', list);
    return json({ ok: true, status: s.status });
  }

  /* ---- 用户（管理员） ---- */
  if (head === 'users') {
    if (seg.length === 1 && method === 'GET') {
      const err = needAdmin(me); if (err) return err;
      const users = await getJSON(env, 'users', []);
      return json(users.map(publicUser));
    }
    const id = seg[1];
    if (seg[2] === 'reset-pwd' && method === 'POST') {
      const err = needAdmin(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      const np = b.password || '123456';
      const users = await getJSON(env, 'users', []);
      const u = users.find(x => x.id === id);
      if (!u) return json({ error: '未找到' }, 404);
      const salt = genSalt(); u.passwordHash = await hashPw(np, salt); u.salt = salt;
      await setJSON(env, 'users', users);
      return json({ ok: true });
    }
    if (method === 'PUT') {
      const err = needAdmin(me); if (err) return err;
      const users = await getJSON(env, 'users', []);
      const u = users.find(x => x.id === id);
      if (!u) return json({ error: '未找到' }, 404);
      const b = await req.json().catch(() => ({}));
      if (b.role !== undefined) u.role = b.role;
      if (b.status !== undefined) u.status = b.status;
      if (b.email !== undefined) u.email = b.email;
      if (b.color !== undefined) u.color = b.color;
      await setJSON(env, 'users', users);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const err = needAdmin(me); if (err) return err;
      const users = await getJSON(env, 'users', []);
      const u = users.find(x => x.id === id);
      if (!u) return json({ error: '未找到' }, 404);
      if (u.role === 'admin') return json({ error: '不能删除管理员账户' }, 400);
      await setJSON(env, 'users', users.filter(x => x.id !== id));
      const softs = await getJSON(env, 'softwares', []); await setJSON(env, 'softwares', softs.filter(x => x.uploaderId !== id));
      const comments = await getJSON(env, 'comments', []); await setJSON(env, 'comments', comments.filter(c => c.userId !== id));
      const logs = await getJSON(env, 'logs', []); await setJSON(env, 'logs', logs.filter(l => l.userId !== id));
      return json({ ok: true });
    }
  }

  /* ---- 评论 ---- */
  if (head === 'comments') {
    if (seg.length === 1 && method === 'GET') {
      let list = await getJSON(env, 'comments', []);
      if (!(me && me.role === 'admin')) list = list.filter(c => c.status === 'visible');
      const softId = q.get('softwareId');
      if (softId) list = list.filter(c => c.softwareId === softId);
      return json(list);
    }
    if (seg.length === 1 && method === 'POST') {
      const err = needAuth(me); if (err) return err;
      const settings = await getJSON(env, 'settings', {});
      if (settings.allowComment === false) return json({ error: '站点已关闭评论' }, 403);
      const b = await req.json().catch(() => ({}));
      if (!b.content || !b.softwareId) return json({ error: '缺少内容' }, 400);
      const list = await getJSON(env, 'comments', []);
      const c = { id: genId('c_'), softwareId: b.softwareId, userId: me.id, content: b.content, time: Date.now(), status: 'visible' };
      list.push(c); await setJSON(env, 'comments', list);
      return json({ ok: true, id: c.id });
    }
    const id = seg[1];
    if (method === 'DELETE') {
      const err = needAdmin(me); if (err) return err;
      const list = await getJSON(env, 'comments', []);
      const c = list.find(x => x.id === id);
      if (!c) return json({ error: '未找到' }, 404);
      await setJSON(env, 'comments', list.filter(x => x.id !== id));
      return json({ ok: true });
    }
  }

  /* ---- 下载记录（管理员） ---- */
  if (head === 'logs' && method === 'GET') {
    const err = needAdmin(me); if (err) return err;
    let list = await getJSON(env, 'logs', []);
    const soft = q.get('softwareId');
    if (soft && soft !== 'all') list = list.filter(l => l.softwareId === soft);
    return json(list);
  }

  /* ---- 分类（管理员写） ---- */
  if (head === 'categories') {
    if (seg.length === 1 && method === 'GET') return json(await getJSON(env, 'categories', []));
    if (seg.length === 1 && method === 'POST') {
      const err = needAdmin(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      if (!b.name) return json({ error: '缺少名称' }, 400);
      const list = await getJSON(env, 'categories', []);
      list.push({ id: genId('c_'), name: b.name, icon: b.icon || '📁' });
      await setJSON(env, 'categories', list);
      return json({ ok: true });
    }
    const id = seg[1];
    if (method === 'PUT') {
      const err = needAdmin(me); if (err) return err;
      const list = await getJSON(env, 'categories', []);
      const c = list.find(x => x.id === id);
      if (!c) return json({ error: '未找到' }, 404);
      const b = await req.json().catch(() => ({}));
      if (b.name !== undefined) c.name = b.name;
      if (b.icon !== undefined) c.icon = b.icon;
      await setJSON(env, 'categories', list);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const err = needAdmin(me); if (err) return err;
      const softs = await getJSON(env, 'softwares', []);
      if (softs.some(s => s.category === id)) return json({ error: '该分类下仍有软件，请先清空' }, 400);
      const list = await getJSON(env, 'categories', []);
      await setJSON(env, 'categories', list.filter(x => x.id !== id));
      return json({ ok: true });
    }
  }

  /* ---- 公告（管理员写） ---- */
  if (head === 'announcements') {
    if (seg.length === 1 && method === 'GET') return json(await getJSON(env, 'announcements', []));
    if (seg.length === 1 && method === 'POST') {
      const err = needAdmin(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      if (!b.title) return json({ error: '缺少标题' }, 400);
      const list = await getJSON(env, 'announcements', []);
      list.push({ id: genId('a_'), title: b.title, content: b.content || '', enabled: b.enabled !== false, createdAt: Date.now() });
      await setJSON(env, 'announcements', list);
      return json({ ok: true });
    }
    const id = seg[1];
    if (method === 'DELETE') {
      const err = needAdmin(me); if (err) return err;
      const list = await getJSON(env, 'announcements', []);
      await setJSON(env, 'announcements', list.filter(x => x.id !== id));
      return json({ ok: true });
    }
  }

  /* ---- 设置（管理员） ---- */
  if (head === 'settings') {
    if (seg.length === 1 && method === 'GET') return json(await getJSON(env, 'settings', {}));
    if (seg.length === 1 && method === 'PUT') {
      const err = needAdmin(me); if (err) return err;
      const b = await req.json().catch(() => ({}));
      const cur = await getJSON(env, 'settings', {});
      const merged = Object.assign(cur, b);
      await setJSON(env, 'settings', merged);
      return json({ ok: true, settings: merged });
    }
  }

  /* ---- 仪表盘统计（管理员） ---- */
  if (head === 'stats' && method === 'GET') {
    const err = needAdmin(me); if (err) return err;
    const [users, softwares, logs, comments, categories] = await Promise.all([
      getJSON(env, 'users', []), getJSON(env, 'softwares', []), getJSON(env, 'logs', []), getJSON(env, 'comments', []), getJSON(env, 'categories', []),
    ]);
    const day = 86400000;
    const now = Date.now();
    const today = logs.filter(l => l.time >= now - day).length;
    const yesterday = logs.filter(l => l.time >= now - 2 * day && l.time < now - day).length;
    const weekUsers = users.filter(u => u.createdAt >= now - 7 * day).length;
    const pending = softwares.filter(s => s.status === 'pending').length;
    const last14 = [];
    for (let d = 13; d >= 0; d--) {
      const start = now - (d + 1) * day, end = now - d * day;
      last14.push({ date: new Date(end).toISOString().slice(0, 10), count: logs.filter(l => l.time >= start && l.time < end).length });
    }
    const catStat = categories.map(c => ({ name: c.name, count: softwares.filter(s => s.category === c.id && s.status === 'approved').length }));
    const top = [...softwares].filter(s => s.status === 'approved').sort((a, b) => b.downloads - a.downloads).slice(0, 5).map(s => ({ name: s.name, downloads: s.downloads }));
    const totalDl = softwares.reduce((a, s) => a + (s.downloads || 0), 0);
    return json({ totalUsers: users.length, weekUsers, approved: softwares.filter(s => s.status === 'approved').length, total: softwares.length, pending, todayDl: today, yesterdayDl: yesterday, totalDl, comments: comments.length, catStat, top, last14 });
  }

  /* ---- 重置演示数据（管理员） ---- */
  if (head === 'reset' && method === 'POST') {
    const err = needAdmin(me); if (err) return err;
    for (const k of ['users', 'softwares', 'comments', 'logs', 'categories', 'announcements', 'settings']) await kv(env).delete(k);
    await ensureSeed(env);
    return json({ ok: true });
  }

  /* ---- 集合整体写入（前端「改完整个数组再保存」模式） ---- */
  if (head === 'collections') {
    const key = seg[1];
    const allowed = ['softwares', 'comments', 'logs', 'categories', 'announcements', 'settings', 'users'];
    if (!allowed.includes(key)) return json({ error: '禁止的集合' }, 403);
    if (['users', 'categories', 'announcements', 'settings'].includes(key)) { const e = needAdmin(me); if (e) return e; }
    else { const e = needAuth(me); if (e) return e; }
    if (method === 'PUT') {
      const body = await req.json().catch(() => null);
      if (body === null) return json({ error: '无效数据' }, 400);
      // settings 是对象（非数组），其余集合为数组
      if (key === 'settings' ? typeof body !== 'object' || Array.isArray(body) : !Array.isArray(body)) {
        return json({ error: '无效数据' }, 400);
      }
      if (key === 'users') {
        // 合并保留 passwordHash/salt，避免明文覆盖导致密码丢失
        const existing = await getJSON(env, 'users', []);
        const exMap = new Map(existing.map(u => [u.id, u]));
        const merged = body.map(u => {
          const ex = exMap.get(u.id);
          if (ex && !u.passwordHash) return Object.assign({}, u, { passwordHash: ex.passwordHash, salt: ex.salt });
          return u;
        });
        await setJSON(env, 'users', merged);
        return json({ ok: true });
      }
      if (key === 'softwares') {
        // 防污染合并：前端缓存经过 stripHeavy（fileData 已清空、旧图片可能被截断），
        // 整组写回时若直接覆盖会清空真实安装包 / 损坏图片。这里用后端已有真实数据兜底。
        const existing = await getJSON(env, 'softwares', []);
        const exMap = new Map(existing.map(s => [s.id, s]));
        const merged = body.map(s => {
          const ex = exMap.get(s.id);
          if (!ex) return s; // 新建的软件（后端还没有）→ 原样保存
          const ns = Object.assign({}, s);
          // fileData 为空（前端拿不到安装包）→ 保留后端真实安装包
          if ((!s.fileData || s.fileData.length < 100) && ex.fileData && ex.fileData.length >= 100) {
            ns.fileData = ex.fileData; ns.fileName = ex.fileName || s.fileName;
          }
          // 前端传回的图片若被截断（含 '…(truncated)' 或 _full 标记）→ 用后端完整图片；前端没传图也用后端
          const frontImgs = s.images || [];
          const truncated = frontImgs.some(im => im && (im._full || (im.data && String(im.data).includes('…(truncated)'))));
          if (ex.images && ex.images.length) {
            if (truncated) ns.images = ex.images;
            else if (!frontImgs.length) ns.images = ex.images;
          }
          return ns;
        });
        await setJSON(env, 'softwares', merged);
        return json({ ok: true });
      }
      await setJSON(env, key, body);
      return json({ ok: true });
    }
    return json({ error: '方法不允许' }, 405);
  }

  return json({ error: 'Not Found', path: '/' + seg.join('/') }, 404);
}

async function startSession(env, user) {
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
  await kv(env).put('session:' + token, user.id, { expirationTtl: 2592000 });
  return json({ me: publicUser(user) }, 200, sessCookie(token));
}
