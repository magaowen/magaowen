/* =====================================================
 * SoftHub —— 数据层（前端 API 与 SSR 共用）
 * 只读为主，附带 ensureSeed / 写入工具。
 * 绑定名：SOFTWARE_HUB_KV（兼容 MY_KV）
 * ===================================================== */

export const KV_KEY = 'SOFTWARE_HUB_KV';
export const kv = (env) => env[KV_KEY] || env['MY_KV'] || env['SOFTWARE_HUB_KV'];

export async function getJSON(env, key, def) {
  const raw = await kv(env).get(key);
  if (raw === null) return def;
  try { return JSON.parse(raw); } catch (e) { return def; }
}
export async function setJSON(env, key, val) {
  await kv(env).put(key, JSON.stringify(val));
}

/* ---------- 密码哈希 (PBKDF2) —— ensureSeed 用 ---------- */
export async function hashPw(pw, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pw), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function genSalt() {
  return [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function genId(p) {
  return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export function publicUser(u) {
  if (!u) return null;
  const { password, passwordHash, salt, ...rest } = u;
  return rest;
}

/* ---------- 默认设置 ---------- */
export const DEFAULT_SETTINGS = {
  siteName: 'SoftHub',
  siteSlogan: '发现 · 分享 · 极致软件体验 —— 游客可自由浏览下载，注册后即可上传分享，可以在后台自由修改',
  heroTitle: '发现下一款改变工作方式的软件',
  requireReview: true, allowRegister: true, allowComment: true, maxUploadMB: 2048, maintenance: false,
  animations: { cardIn: true, spinner: true, hover: true, modalPop: true },
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

export async function migrateSettings(env) {
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
  if (!cur.animations) { merged.animations = DEFAULT_SETTINGS.animations; changed = true; }
  if (changed) await setJSON(env, 'settings', merged);
}

export async function ensureSeed(env) {
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
  await setJSON(env, 'softwares', []);
  await setJSON(env, 'comments', []);
  await setJSON(env, 'logs', []);
  await setJSON(env, 'announcements', [
    { id: 'a_1', title: '🎉 SoftHub 全新改版上线', content: '全新科技感界面、明暗模式自动切换，欢迎体验并反馈建议！', enabled: true, createdAt: now - 3 * day },
    { id: 'a_2', title: '📢 上传规范提醒', content: '请勿上传含捆绑插件的安装包，审核不通过将被驳回。', enabled: false, createdAt: now - 10 * day },
  ]);
  await setJSON(env, 'settings', { ...DEFAULT_SETTINGS });
}

/* ---------- 图片剥离（列表只带缩略图） ---------- */
const SMALL_IMG = 60 * 1024;
export function stripHeavy(s) {
  if (!s) return s;
  const rest = { ...s };
  rest.fileData = '';
  return rest;
}
export function stripForList(s) {
  if (!s) return s;
  const rest = stripHeavy(s);
  const imgs = Array.isArray(rest.images) ? rest.images : [];
  let thumb = rest.thumb || '';
  if (!thumb && imgs.length) {
    const cover = imgs.find(i => i && i.id === rest.coverId) || imgs[0];
    const data = (cover && cover.data) || '';
    if (data && data.length <= SMALL_IMG) thumb = data;
  }
  rest.thumb = thumb;
  rest.imageCount = imgs.length;
  rest.images = [];
  return rest;
}
export function stripHeavyList(list) {
  return (list || []).map(stripForList);
}

/* ---------- 聚合读取 ---------- */
export async function loadAll(env) {
  const [users, softwares, comments, logs, categories, announcements, settings] = await Promise.all([
    getJSON(env, 'users', []), getJSON(env, 'softwares', []), getJSON(env, 'comments', []),
    getJSON(env, 'logs', []), getJSON(env, 'categories', []), getJSON(env, 'announcements', []), getJSON(env, 'settings', {}),
  ]);
  return { users, softwares, comments, logs, categories, announcements, settings: settings || {} };
}

/* 公开可见的软件（已上架），列表用 stripForList */
export async function getPublicSoftwares(env) {
  const list = await getJSON(env, 'softwares', []);
  return list.filter(s => s.status === 'approved').map(stripForList);
}
export async function getSoftwareFull(env, id) {
  const list = await getJSON(env, 'softwares', []);
  const s = list.find(x => x.id === id);
  return s ? stripHeavy(s) : null;
}
export async function getVisibleComments(env, softwareId) {
  const list = await getJSON(env, 'comments', []);
  return list.filter(c => c.status === 'visible' && c.softwareId === softwareId)
    .sort((a, b) => a.time - b.time);
}

/* ---------- SSR 辅助 ---------- */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function fmtSize(n) {
  n = n || 0;
  if (n >= 1024) return (n / 1024).toFixed(n >= 10240 ? 0 : 1) + ' GB';
  if (n >= 1) return (n % 1 === 0 ? n : n.toFixed(1)) + ' MB';
  return '未知';
}
export function fmtNum(n) {
  n = n || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  return String(n);
}
export function stars(r) {
  r = r || 0; let s = '';
  for (let i = 1; i <= 5; i++) s += i <= Math.round(r) ? '⭐' : '☆';
  return s;
}
export function getCover(s) {
  if (!s) return null;
  if (s.thumb) return s.thumb;
  const imgs = s.images || [];
  if (imgs.length) { const c = imgs.find(i => i.id === s.coverId) || imgs[0]; return c.data || null; }
  return null;
}
export function getFullCover(s) {
  if (!s) return null;
  const imgs = s.images || [];
  if (imgs.length) { const c = imgs.find(i => i.id === s.coverId) || imgs[0]; return c.data || null; }
  return s.thumb || null;
}
