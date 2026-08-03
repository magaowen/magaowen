/* =====================================================
 * SoftHub —— SSR HTML 渲染（服务端拼接真实内容）
 * 供 functions/index.js 与 functions/s/[id].js 调用。
 * ===================================================== */
import {
  esc, fmtSize, fmtNum, stars, getCover, getFullCover,
  loadAll, getSoftwareFull, getVisibleComments, ensureSeed, getJSON,
} from './_db.js';

/* 与 index.html 内联样式保持一致，保证 SSR 页面外观一致 */
const SHELL_CSS = `
.header { position: sticky; top: 0; z-index: 100; background: var(--header-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
.header-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; gap: 18px; }
.logo { display: flex; align-items: center; gap: 10px; font-size: 21px; font-weight: 800; flex: none; }
.logo .logo-icon { width: 36px; height: 36px; border-radius: 11px; background: var(--grad); display: flex; align-items: center; justify-content: center; font-size: 19px; box-shadow: var(--glow); }
.search-box { flex: 1; max-width: 460px; position: relative; }
.search-box input { padding-left: 40px; border-radius: 12px; width:100%; }
.search-box .s-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text3); }
.header-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.hero { max-width: 1280px; margin: 0 auto; padding: 54px 24px 8px; text-align: center; }
.hero h1 { font-size: clamp(30px, 4.6vw, 50px); font-weight: 900; letter-spacing: -0.02em; line-height: 1.2; }
.hero p.sub { color: var(--text2); margin: 14px 0 26px; font-size: 16px; }
.hero-stats { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
.hstat { padding: 14px 30px; border-radius: 16px; background: var(--card); border: 1px solid var(--border); backdrop-filter: blur(10px); min-width: 130px; }
.hstat b { font-size: 24px; display: block; }
.hstat span { font-size: 12.5px; color: var(--text3); }
.announce { max-width: 1280px; margin: 26px auto 0; padding: 0 24px; }
.announce-inner { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: var(--grad-soft); border: 1px solid var(--border); border-radius: 14px; font-size: 13.5px; color: var(--text2); }
.announce-inner b { color: var(--primary); }
.toolbar { max-width: 1280px; margin: 30px auto 20px; padding: 0 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { padding: 7px 16px; border-radius: 999px; font-size: 13.5px; background: var(--bg3); border: 1px solid var(--border); color: var(--text2); cursor:pointer; transition: all .2s; }
.chip:hover { border-color: var(--primary); color: var(--primary); }
.chip.on { background: var(--grad); color: #fff; border-color: transparent; box-shadow: var(--glow); }
.toolbar select { width: auto; padding: 8px 32px 8px 14px; border-radius: 999px; font-size: 13.5px; }
.grid { max-width: 1280px; margin: 0 auto 60px; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 18px; }
.soft-card { padding: 20px; cursor: pointer; position: relative; overflow: hidden; }
.soft-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--primary); }
.soft-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--grad); opacity: 0; transition: opacity .25s; }
.soft-card:hover::after { opacity: 1; }
.sc-head { display: flex; gap: 14px; align-items: flex-start; }
.sc-icon { width: 54px; height: 54px; border-radius: 15px; flex: none; background: var(--grad-soft); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 28px; overflow:hidden; }
.sc-icon img { width:54px; height:54px; object-fit:cover; display:block; }
.sc-title { font-size: 16.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sc-ver { font-size: 11px; color: var(--text3); font-weight: 400; }
.sc-meta { font-size: 12px; color: var(--text3); margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; }
.sc-desc { font-size: 13px; color: var(--text2); line-height: 1.65; margin: 12px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 42px; }
.sc-foot { display: flex; align-items: center; justify-content: space-between; }
.sc-dl { font-size: 12.5px; color: var(--text3); display: flex; align-items: center; gap: 4px; }
.sc-tags { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg3); color: var(--text3); }
.empty { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text3); }
.footer { border-top: 1px solid var(--border); padding: 34px 24px; text-align: center; color: var(--text3); font-size: 13px; background: var(--bg2); }
.footer a { margin: 0 10px; color: var(--text2); }
.footer a:hover { color: var(--primary); }
.biz { max-width: 1280px; margin: 8px auto 60px; padding: 40px 24px 0; }
.biz-inner { background: var(--card); border: 1px solid var(--border); border-radius: 22px; padding: 38px 28px; backdrop-filter: blur(10px); }
.biz-head { text-align: center; margin-bottom: 6px; }
.biz-head h2 { font-size: clamp(22px, 3vw, 30px); font-weight: 800; }
.biz-desc { text-align:center;color:var(--text2);margin:6px 0 20px; }
.biz-contact { display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px; }
.biz-contact > div { display:flex;align-items:center;gap:12px;padding:13px 18px;background:var(--bg3);border:1px solid var(--border);border-radius:14px; }
.detail-page { max-width: 1000px; margin: 0 auto; padding: 0 24px 60px; }
.breadcrumb { padding: 18px 0; }
.breadcrumb a { color: var(--text2); font-size: 13.5px; text-decoration: none; }
.breadcrumb a:hover { color: var(--primary); }
@media (max-width:720px){ .header-inner{flex-wrap:wrap;height:auto;padding:10px 14px;gap:10px 12px;} .search-box{order:3;flex-basis:100%;max-width:100%;} .hero{padding:30px 16px 4px;} .grid{grid-template-columns:1fr;padding:0 14px;} .toolbar{padding:0 14px;} .biz{padding:20px 14px 0;} .biz-inner{padding:24px 16px;} .detail-page{padding:0 14px 60px;} }
`;

const CSS_VER = 'css20260803';
const JS_VER = 'p20260803c';

function head(opts) {
  const title = esc(opts.title || 'SoftHub · 软件分享平台');
  const desc = esc(opts.description || 'SoftHub —— 发现与分享优质软件，游客可自由浏览下载，注册后即可上传分享。');
  const url = esc(opts.url || 'https://soft-share.pages.dev/');
  const og = `
  <meta name="description" content="${desc}">
  <meta property="og:type" content="${opts.ogType || 'website'}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${url}">`;
  const jsonld = opts.jsonld ? `\n  <script type="application/ld+json">${JSON.stringify(opts.jsonld)}</script>` : '';
  const theme = `<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="msvalidate.01" content="72AD859DB28627E90D5491138B70099D">
<title>${title}</title>${og}${jsonld}
<link rel="stylesheet" href="/css/main.css?v=${CSS_VER}">
<style>${SHELL_CSS}</style>
${theme}
</head>`;
}

function headerHtml(st) {
  return `<header class="header">
  <div class="header-inner">
    <a class="logo" href="/" style="text-decoration:none;color:inherit"><span class="logo-icon">⚡</span><span id="siteName">${esc(st.siteName || 'SoftHub')}</span></a>
    <div class="search-box"><span class="s-icon">🔍</span><input id="searchInput" name="q" autocomplete="off" placeholder="搜索软件名称、标签…"></div>
    <div class="header-actions">
      <button class="theme-btn" onclick="Theme.cycle()">🌗</button>
      <div id="authArea"><button class="btn btn-ghost" onclick="App.openAuth('login')">登录</button><button class="btn btn-primary" onclick="App.openAuth('reg')">注册账户</button></div>
    </div>
  </div>
</header>`;
}

function heroHtml(st, stats) {
  return `<section class="hero">
  <h1 id="heroTitle" class="grad-text">${esc(st.heroTitle || '发现下一款改变工作方式的软件')}</h1>
  <p class="sub" id="siteSlogan">${esc(st.siteSlogan || '')}</p>
  <div class="hero-stats" id="heroStats">
    <div class="hstat"><b class="grad-text">${stats.softs}</b><span>精选软件</span></div>
    <div class="hstat"><b class="grad-text">${fmtNum(stats.dl)}</b><span>累计下载</span></div>
    <div class="hstat"><b class="grad-text">${stats.users}</b><span>注册用户</span></div>
    <div class="hstat"><b class="grad-text">${stats.cats}</b><span>软件分类</span></div>
  </div>
</section>`;
}

function announceHtml(list) {
  if (!list || !list.length) return '<div class="announce" id="announceBar"></div>';
  const a = list[0];
  return `<div class="announce" id="announceBar"><div class="announce-inner">📣 <b>${esc(a.title)}</b> ${esc(a.content)}</div></div>`;
}

function toolbarHtml(cats) {
  let chips = '<button class="chip on" onclick="App.setCat(\'all\')">全部</button>';
  (cats || []).forEach(c => { chips += `<button class="chip" onclick="App.setCat('${esc(c.id)}')">${c.icon || ''} ${esc(c.name)}</button>`; });
  return `<div class="toolbar">
  <div class="chips" id="catChips">${chips}</div>
  <select id="sortSel" style="margin-left:auto">
    <option value="hot">🔥 最热下载</option>
    <option value="new">🕐 最新发布</option>
    <option value="rate">⭐ 评分最高</option>
  </select>
</div>`;
}

function bizHtml(st) {
  const biz = st.business || {};
  if (biz.enabled === false) return '<section class="biz" id="bizSection" style="display:none"></section>';
  const cs = (biz.contacts || []).filter(c => c && c.value);
  let contact = '';
  if (cs.length) contact = `<div class="biz-contact">${cs.map(c => `<div><span style="font-size:24px">${c.icon || '📞'}</span><div><div style="font-size:12px;color:var(--text3)">${esc(c.label)}</div><div style="font-size:14.5px;font-weight:600">${esc(c.value)}</div></div></div>`).join('')}</div>`;
  return `<section class="biz" id="bizSection"><div class="biz-inner"><div class="biz-head"><h2>${esc(biz.title || '商务合作')}</h2></div>${biz.desc ? `<p class="biz-desc">${esc(biz.desc)}</p>` : ''}${contact}</div></section>`;
}

function footerHtml() {
  return `<footer class="footer">
  <div style="margin-bottom:10px">
    <a href="/admin.html">🛠️ 后台管理</a>
    <a href="javascript:void(0)" onclick="App.openUpload()">📤 上传软件</a>
    <a href="javascript:void(0)" onclick="App.scrollToBiz()">🤝 商务合作</a>
    <a href="/sitemap.xml">🗺️ 站点地图</a>
    <a href="javascript:void(0)" onclick="window.scrollTo({top:0,behavior:'smooth'})">⬆️ 回到顶部</a>
  </div>
  © 2026 SoftHub · 发现与分享优质软件
</footer>`;
}

function modalsHtml() {
  return `
<div class="modal-mask" id="authModal" onclick="if(event.target===this)App.close('authModal')">
  <div class="modal">
    <div class="modal-head"><h3 id="authTitle">👋 欢迎回来</h3><button class="modal-close" onclick="App.close('authModal')">✕</button></div>
    <p class="hint" id="authHint">登录后即可上传软件、发表评论</p>
    <div id="loginForm"><label>用户名</label><input id="loginUser" placeholder="请输入用户名"><label>密码</label><input id="loginPass" type="password" placeholder="请输入密码"><button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="App.doLogin()">登 录</button><p class="hint" style="text-align:center;margin-top:14px">还没有账户？<a href="javascript:void(0)" onclick="App.switchAuth('reg')">立即注册</a></p></div>
    <div id="regForm" style="display:none"><label>用户名 *</label><input id="regUser" placeholder="2-16 位字母、数字、下划线或中文"><label>邮箱 *</label><input id="regEmail" type="email" placeholder="you@example.com"><label>密码 *</label><input id="regPass" type="password" placeholder="至少 6 位"><label>确认密码 *</label><input id="regPass2" type="password" placeholder="再次输入密码"><button class="btn btn-primary" style="width:100%;margin-top:20px" onclick="App.doRegister()">注 册</button><p class="hint" style="text-align:center;margin-top:14px">已有账户？<a href="javascript:void(0)" onclick="App.switchAuth('login')">去登录</a></p></div>
  </div>
</div>
<div class="modal-mask" id="uploadModal" onclick="if(event.target===this)App.close('uploadModal')"><div class="modal modal-lg" id="uploadBody"></div></div>
<div class="modal-mask" id="detailModal" onclick="if(event.target===this)App.close('detailModal')"><div class="modal modal-lg" id="detailBody"></div></div>
<div class="modal-mask" id="mineModal" onclick="if(event.target===this)App.close('mineModal')"><div class="modal modal-lg" id="mineBody"></div></div>`;
}

function scriptsHtml() {
  return `<script src="/js/db.js?v=${JS_VER}"></script>
<script src="/js/app-new.js?v=${JS_VER}"></script>`;
}

function cardHtml(s, cat, i) {
  const cover = getCover(s);
  const iconSrc = s.iconImage || cover;
  const iconHtml = iconSrc
    ? `<img src="${iconSrc}" alt="${esc(s.name)} 图标">`
    : (s.icon || '📦');
  const dlHref = (s.link && /^https?:/i.test(s.link))
    ? `href="${esc(s.link)}" target="_blank" rel="noopener"`
    : `href="/s/${esc(s.id)}"`;
  const desc = (s.desc || '').length > 120 ? (s.desc.slice(0, 120) + '…') : (s.desc || '');
  return `<div class="card soft-card" data-id="${esc(s.id)}" style="animation-delay:${(Math.min(i, 15) * 0.05).toFixed(2)}s">
  <a class="sc-link" href="/s/${esc(s.id)}" style="text-decoration:none;color:inherit;display:block">
    <div class="sc-head">
      <div class="sc-icon ${iconSrc ? 'thumb' : ''}">${iconHtml}</div>
      <div style="min-width:0">
        <div class="sc-title">${esc(s.name)} <span class="sc-ver">v${esc(s.version)}</span></div>
        <div class="sc-meta"><span>${cat ? (cat.icon + ' ' + esc(cat.name)) : ''}</span><span>💾 ${fmtSize(s.size)}</span></div>
      </div>
    </div>
    <p class="sc-desc">${esc(desc)}</p>
    <div class="sc-tags">${(s.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
  </a>
  <div class="sc-foot">
    <span class="sc-dl">${stars(s.rating)} <span style="margin-left:4px">⬇ ${fmtNum(s.downloads)}</span></span>
    <a class="btn btn-primary btn-sm" ${dlHref} onclick="event.stopPropagation()">⬇ 下载</a>
  </div>
</div>`;
}

/* ============ 首页 ============ */
export async function buildHome(env) {
  const { softwares, categories, announcements, settings } = await loadAllSafe(env);
  const catsMap = {};
  categories.forEach(c => { catsMap[c.id] = c; });
  const list = [...softwares].filter(s => s.status === 'approved');
  let totalDl = 0; list.forEach(s => { totalDl += (s.downloads || 0); });
  list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

  const cards = list.length
    ? list.map((s, i) => cardHtml(s, catsMap[s.category], i)).join('')
    : '<div class="empty"><div class="icon">🔭</div>还没有上架的软件，快来上传第一款吧</div>';

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: (settings.siteName || 'SoftHub') + ' 软件列表',
    itemListElement: list.slice(0, 20).map((s, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'SoftwareApplication', name: s.name,
        applicationCategory: catsMap[s.category] ? catsMap[s.category].name : '软件',
        operatingSystem: (s.os || []).join(', '),
        softwareVersion: s.version,
        url: 'https://soft-share.pages.dev/s/' + s.id,
      },
    })),
  };

  const body = `${headerHtml(settings)}
${heroHtml(settings, { softs: list.length, dl: totalDl, users: (await getJSON(env, 'users', [])).length, cats: categories.length })}
${announceHtml(announcements.filter(a => a.enabled))}
${toolbarHtml(categories)}
<main class="grid" id="softGrid">${cards}</main>
${bizHtml(settings)}
${footerHtml()}
${modalsHtml()}
${scriptsHtml()}`;

  return head({
    title: (settings.siteName || 'SoftHub') + ' · 软件分享平台',
    description: settings.siteSlogan || '发现与分享优质软件，游客可自由浏览下载，注册后即可上传分享。',
    url: 'https://soft-share.pages.dev/',
    jsonld,
  }) + `<body data-ssr="1">${body}</body></html>`;
}

/* ============ 详情页 ============ */
export async function buildDetail(env, id) {
  const s = await getSoftwareFull(env, id);
  if (!s || s.status !== 'approved') {
    return notFound(env);
  }
  const { categories, users, comments, settings } = await loadAllSafe(env);
  const cat = categories.find(c => c.id === s.category);
  const up = users.find(u => u.id === s.uploaderId);
  const cover = getCover(s);  // 封面用缩略图(360px)，避免原图(base64 数百 KB)拖慢首屏
  const iconSrc = s.iconImage || cover;
  const imgs = (s.images && s.images.length) ? s.images.slice(0, 3) : (cover ? [{ data: cover }] : []);
  const gallery = imgs.length
    ? `<div class="detail-gallery">${imgs.map(im => `<div class="dg-item"><img src="${im.data}" alt="${esc(s.name)} 截图" loading="lazy"></div>`).join('')}</div>`
    : '';
  const dlBtn = (s.link && /^https?:/i.test(s.link))
    ? `<a class="btn btn-primary" style="align-self:center;flex:none" href="${esc(s.link)}" target="_blank" rel="noopener">⬇ 立即下载</a>`
    : `<a class="btn btn-primary" style="align-self:center;flex:none" href="/s/${esc(s.id)}#download">⬇ 获取下载</a>`;

  const cmts = await getVisibleComments(env, id);
  const commentsHtml = cmts.length
    ? cmts.map(c => {
        const u = users.find(x => x.id === c.userId);
        const name = u ? u.username : '匿名用户';
        const color = (u && u.color) || '#888';
        const avatar = (name[0] || '?').toUpperCase();
        return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="width:34px;height:34px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex:none">${avatar}</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><b style="font-size:13.5px">${esc(name)}</b><span style="font-size:11px;color:var(--text3)">${new Date(c.time).toLocaleDateString('zh-CN')}</span></div><p style="margin:0;font-size:13.5px;line-height:1.7;color:var(--text2)">${esc(c.content)}</p></div></div>`;
      }).join('')
    : '<p style="color:var(--text3);padding:8px 0">暂无评论，来说说吧～</p>';

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: s.name,
    description: (s.desc || '').slice(0, 200),
    applicationCategory: cat ? cat.name : '软件',
    operatingSystem: (s.os || []).join(', '),
    softwareVersion: s.version,
    url: 'https://soft-share.pages.dev/s/' + s.id,
    ...(s.link ? { downloadUrl: s.link } : {}),
    ...((s.ratingCount > 0) ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(s.rating.toFixed(1)), ratingCount: s.ratingCount } } : {}),
  };

  const detail = `<div class="detail-page">
  <div class="breadcrumb"><a href="/">← 返回软件列表</a></div>
  <div class="detail-head">
    <div style="font-size:52px">${iconSrc ? `<img src="${iconSrc}" style="width:88px;height:88px;border-radius:24px" alt="${esc(s.name)}">` : (s.icon || '📦')}</div>
    <div style="flex:1;min-width:0">
      <h2 style="font-size:24px;line-height:1.3;margin:0">${esc(s.name)} <span class="badge badge-info">v${esc(s.version)}</span></h2>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <span class="badge badge-gray">${cat ? (cat.icon + ' ' + esc(cat.name)) : '未分类'}</span>
        ${(s.os || []).map(o => `<span class="badge badge-gray">${esc(o)}</span>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:12.5px;color:var(--text3)">由 <b>${esc(up ? up.username : '未知用户')}</b> 分享于 ${new Date(s.createdAt).toLocaleDateString('zh-CN')}</div>
    </div>
    ${dlBtn}
  </div>
  <div class="detail-stats">
    <div class="dstat"><b>${fmtNum(s.downloads)}</b><span>下载量</span></div>
    <div class="dstat"><b>${fmtNum(s.views || 0)}</b><span>浏览量</span></div>
    <div class="dstat"><b>${s.rating ? s.rating.toFixed(1) : '—'}</b><span>评分</span></div>
    <div class="dstat"><b>${fmtSize(s.size)}</b><span>大小</span></div>
  </div>
  <div class="detail-body">${esc(s.desc)}</div>
  <div class="detail-tags sc-tags">${(s.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
  ${gallery}
  <div id="detailComments" style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
    <h4 style="margin:0 0 12px;font-size:16px">💬 用户评论</h4>
    <div id="commentList">${commentsHtml}</div>
    <div id="cmtFormSlot"><p class="hint" style="margin:8px 0">登录后即可发表评论</p></div>
  </div>
</div>`;

  const body = `${headerHtml(settings)}${detail}${footerHtml()}${modalsHtml()}${scriptsHtml()}`;
  const descText = (s.desc || '').replace(/\s+/g, ' ').slice(0, 150);
  return head({
    title: `${s.name} v${s.version} - ${(cat ? cat.name : '软件')} | ${settings.siteName || 'SoftHub'}`,
    description: descText || `${s.name} 是一款${cat ? cat.name : '软件'}，支持 ${(s.os || []).join('、')}，可在 SoftHub 免费下载。`,
    url: 'https://soft-share.pages.dev/s/' + s.id,
    ogType: 'article',
    jsonld,
  }) + `<body data-ssr="1" data-detail="1" data-id="${esc(s.id)}">${body}</body></html>`;
}

function notFound(env) {
  const settings = {};
  const body = `${headerHtml(settings)}<div class="empty" style="padding:120px 20px"><div class="icon">🔍</div><h2>未找到该软件</h2><p>它可能已被删除或未通过审核。<a href="/" style="color:var(--primary)">返回首页</a></p></div>${footerHtml()}${modalsHtml()}${scriptsHtml()}`;
  return head({ title: '未找到 - SoftHub', description: '未找到该软件' }) + `<body>${body}</body></html>`;
}

/* loadAll 安全包装（保证 seed 存在） */
async function loadAllSafe(env) {
  await ensureSeed(env);
  const { softwares, categories, announcements, settings, users, comments } = await loadAll(env);
  return { softwares, categories, announcements, settings, users, comments };
}

/* 供 sitemap 使用 */
export async function allSoftwareIds(env) {
  const list = await getJSON(env, 'softwares', []);
  return list.filter(s => s.status === 'approved').map(s => s.id);
}

// 把 ensureSeed / getJSON 也导出给函数文件直接调用
export { ensureSeed, getJSON };
