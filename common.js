/* common.js — 公共前端库（主题 / 鉴权 / API / 城市数据 / 图片压缩）
   以普通 <script> 引入，所有函数挂在 window 上供各页面复用 */

// ===================== 主题 =====================
function initTheme() {
  const s = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", s);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = s === "dark" ? "☀️" : "🌙";
}
function toggleTheme() {
  const n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", n);
  localStorage.setItem("theme", n);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = n === "dark" ? "☀️" : "🌙";
}

// ===================== 鉴权 =====================
function getToken() { return localStorage.getItem("token") || ""; }
function getUser() { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch (e) { return null; } }
function setAuth(token, user) { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(user)); }
function clearAuth() { localStorage.removeItem("token"); localStorage.removeItem("user"); }
function isLogin() { return !!getToken(); }
function doLogout() { clearAuth(); location.href = "/"; }

// ===================== API =====================
async function api(path, opts = {}) {
  const headers = Object.assign({ "content-type": "application/json" }, opts.headers || {});
  const tk = getToken();
  if (tk) headers["authorization"] = "Bearer " + tk;
  const method = opts.method || "GET";
  const init = { method, headers };
  if (opts.body) init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  try {
    const res = await fetch(path, init);
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (res.status === 401 && isLogin() && !path.startsWith("/api/auth/me")) clearAuth();
    return data;
  } catch (e) {
    return { ok: false, error: "网络错误：" + e.message, __net: true };
  }
}
const apiGet = p => api(p, { method: "GET" });
const apiPost = (p, b) => api(p, { method: "POST", body: JSON.stringify(b) });
const apiPut = (p, b) => api(p, { method: "PUT", body: JSON.stringify(b) });
const apiDel = p => api(p, { method: "DELETE" });

// 顶部账户条：登录按钮 或 用户名+退出
function renderAccBar() {
  const el = document.getElementById("accBar");
  if (!el) return;
  const u = getUser();
  if (u) {
    const back = encodeURIComponent(location.pathname + location.search);
    el.innerHTML = `<a class="acc-link" href="/mine.html?back=${back}">${esc(u.name || u.phone)}</a>` +
      (u.type === "admin" ? `<a class="acc-link" href="/admin.html">后台</a>` : ``) +
      `<a class="acc-link" href="javascript:;" onclick="doLogout()">退出</a>`;
  } else {
    const back = encodeURIComponent(location.pathname + location.search);
    el.innerHTML = `<a class="acc-link" href="/auth.html?redirect=${back}">登录/注册</a>`;
  }
}

// ===================== 工具 =====================
function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
}

const STATUS_LABEL = { pending: "审核中", active: "已上架", rejected: "已拒绝", offline: "已下架" };
const STATUS_COLOR = { pending: "#f5a623", active: "#4caf50", rejected: "#f44336", offline: "#888" };

// ===================== 城市数据 =====================
let PROVINCE_DATA = [];
const CITY = {}, DIST = {};
const MUNI = ["北京市", "天津市", "上海市", "重庆市"];

async function ensureAreas() {
  if (!PROVINCE_DATA.length) {
    try { PROVINCE_DATA = await (await fetch("./data-areas.json")).json(); } catch (e) { PROVINCE_DATA = []; }
  }
  return PROVINCE_DATA;
}
function buildIdx() {
  if (!PROVINCE_DATA.length) return;
  PROVINCE_DATA.forEach(p => {
    CITY[p.name] = []; DIST[p.name] = {};
    p.c.forEach(c => {
      if (MUNI.includes(p.name)) {
        if (!CITY[p.name].length) CITY[p.name] = ["全市"];
        DIST[p.name]["全市"] = c.d;
        if (!c.d.length) { CITY[p.name].push(c.name); DIST[p.name][c.name] = []; }
      } else {
        CITY[p.name].push(c.name); DIST[p.name][c.name] = c.d;
      }
    });
    if (!DIST[p.name]["全市"]) DIST[p.name]["全市"] = [];
  });
}

// 初始化省市区下拉并联动；sel={provId,cityId,distId,provPlaceholder,cityPlaceholder,distPlaceholder}
async function initCitySelects(sel) {
  await ensureAreas();
  buildIdx();
  const ps = document.getElementById(sel.provId);
  if (!ps) return;
  ps.innerHTML = '<option value="">' + (sel.provPlaceholder || "省份") + '</option>';
  PROVINCE_DATA.forEach(p => ps.add(new Option(p.name, p.name)));
  ps.onchange = () => {
    const pv = ps.value;
    const cc = document.getElementById(sel.cityId);
    cc.innerHTML = '<option value="">' + (sel.cityPlaceholder || "城市") + '</option>';
    const ds = document.getElementById(sel.distId);
    if (ds) ds.innerHTML = '<option value="">' + (sel.distPlaceholder || "区县") + '</option>';
    if (pv && CITY[pv]) CITY[pv].forEach(c => cc.add(new Option(c, c)));
    if (sel.onProv) sel.onProv(pv);
  };
  const cs = document.getElementById(sel.cityId);
  if (cs) cs.onchange = () => {
    const ct = cs.value;
    const ds = document.getElementById(sel.distId);
    if (ds) {
      ds.innerHTML = '<option value="">' + (sel.distPlaceholder || "区县") + '</option>';
      if (ct && DIST[ct]) DIST[ct].forEach(d => ds.add(new Option(d, d)));
    }
    if (sel.onCity) sel.onCity(ct);
  };
}

// 编辑时回填省市区
function applyCityValues(provId, cityId, distId, prov, city, dist) {
  buildIdx();
  const ps = document.getElementById(provId); if (!ps) return;
  ps.value = prov || "";
  const cs = document.getElementById(cityId);
  if (cs) {
    cs.innerHTML = '<option value="">城市</option>';
    if (prov && CITY[prov]) CITY[prov].forEach(c => cs.add(new Option(c, c)));
    cs.value = city || "";
  }
  const ds = document.getElementById(distId);
  if (ds) {
    ds.innerHTML = '<option value="">区县</option>';
    if (city && DIST[city]) DIST[city].forEach(d => ds.add(new Option(d, d)));
    ds.value = dist || "";
  }
}

// ===================== 图片压缩 =====================
function compressImg(file, mw = 800, mh = 800, mx = 200 * 1024) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > mw) { h = h * mw / w; w = mw; }
        if (h > mh) { w = w * mh / h; h = mh; }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        let q = .85, b64;
        (function qq() { b64 = c.toDataURL("image/jpeg", q); if (b64.length * 3 / 4 > mx && q > .3) { q -= .1; qq(); } else ok(b64); })();
      };
      img.onerror = () => no(new Error("图片格式不支持"));
      img.src = e.target.result;
    };
    r.onerror = () => no(new Error("读取失败"));
    r.readAsDataURL(file);
  });
}

// 页面加载后自动初始化主题与账户条
document.addEventListener("DOMContentLoaded", () => { initTheme(); renderAccBar(); });
