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

// ===================== 品种库（全品类，下拉建议 + 可自定义） =====================
const BREEDS = {
  "猫咪": ["英国短毛猫","美国短毛猫","布偶猫","暹罗猫","缅因猫","苏格兰折耳猫","英国长毛猫","波斯猫","异国短毛猫(加菲)","俄罗斯蓝猫","阿比西尼亚猫","伯曼猫","缅甸猫","土耳其安哥拉猫","挪威森林猫","曼基康猫(矮脚)","塞尔凯克卷毛猫","斯芬克斯猫(无毛)","东方短毛猫","埃及猫","欧洲短毛猫","索马里猫","东奇尼猫","加州闪亮猫","喜马拉雅猫","美国卷耳猫","拉邦猫","日本短尾猫","呵叻猫","千岛短尾猫","玩具虎猫","巴厘猫","波米拉猫","孟加拉豹猫","狸花猫","橘猫","三花猫","黑白猫","山东狮子猫","临清狮猫","新加坡猫","沙特尔猫","孟买猫","蒂凡尼猫","威尔斯猫","德文卷毛猫","康沃尔卷毛猫","美国短尾猫","中华田园猫"],
  "狗狗": ["金毛寻回犬","拉布拉多","泰迪(贵宾)","比熊","柯基","哈士奇","萨摩耶","边境牧羊犬","德国牧羊犬","柴犬","法国斗牛犬","英国斗牛犬","博美","雪纳瑞","巴哥","吉娃娃","约克夏","马尔济斯","西施","松狮","阿拉斯加","秋田","美国恶霸","杜宾","罗威纳","腊肠","比格","巴吉度","大丹","藏獒","北京犬","蝴蝶犬","阿富汗猎犬","灵缇","惠比特","史宾格","可卡","威玛","伯恩山","纽芬兰","圣伯纳","苏格兰牧羊犬","万能梗","爱尔兰梗","西高地白梗","刚毛猎狐梗","杰克罗素","迷你品","中国冠毛犬","巴仙吉","沙皮","寻血猎犬","伯德梗","边境梗","凯恩梗","澳大利亚牧牛犬","澳大利亚牧羊犬","拳师","贝灵顿","波士顿梗","斗牛獒","大白熊","古代英国牧羊犬","荷兰毛狮","卡斯罗","高加索","马犬","昆明犬","中华田园犬","比特犬"],
  "小宠": ["金丝熊(黄金仓鼠)","三线仓鼠","熊类仓鼠","荷兰猪(豚鼠)","垂耳兔","侏儒兔","猫猫兔","龙猫(毛丝鼠)","花枝鼠","松鼠","非洲迷你刺猬","蜜袋鼯","雪貂","荷兰兔","侏儒仓鼠"],
  "鸟类": ["金刚鹦鹉","玄凤鹦鹉","虎皮鹦鹉","牡丹鹦鹉","和尚鹦鹉","吸蜜鹦鹉","画眉","绣眼","百灵","八哥","鹩哥","文鸟","珍珠鸟","金丝雀","鸽子","芦丁鸡","芙蓉鸟"],
  "水族": ["金鱼","锦鲤","孔雀鱼","神仙鱼","龙鱼","招财鱼","地图鱼","鹦鹉鱼","鼠鱼","灯鱼","斗鱼","七彩神仙","罗汉鱼","银龙","清道夫","孔雀"],
  "爬宠": ["草龟","巴西龟","苏卡达陆龟","赫曼陆龟","豹纹陆龟","鬃狮蜥","豹纹守宫","绿鬣蜥","玉米蛇","球蟒","睫角守宫","蓝舌石龙子","乌龟"],
  "异宠": ["蓝狐","银狐","羊驼","浣熊","蜜熊","角蛙","树蛙","智利红玫瑰蜘蛛","蝎子","螳螂","小飞鼠","雪貂","龙猫"]
};

// 当分类(类目)变化时，刷新品种下拉建议；品种框始终允许自由输入
function initBreedDatalist(catId, breedInputId, datalistId) {
  const cat = document.getElementById(catId);
  const breed = document.getElementById(breedInputId);
  const dl = document.getElementById(datalistId);
  if (!cat || !breed || !dl) return;
  const upd = () => { dl.innerHTML = (BREEDS[cat.value] || []).map(b => `<option value="${esc(b)}">`).join(""); };
  cat.addEventListener("change", upd);
  upd();
}

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
