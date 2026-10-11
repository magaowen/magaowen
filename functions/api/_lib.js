// ============================================================================
//  小鱼会员管理 · 云端公共模块
//  所有 API 都要用，这里放 KV 键名、鉴权、CORS、工具函数。
//  路径：functions/api/_lib.js（Cloudflare Pages Functions 不会把下划线文件当路由）
// ============================================================================

/** KV 里用到的键名。集中放这里，别到处写字符串。 */
export const KEYS = {
  ADMIN_PASS: "xy_admin_pass",     // 后台密码
  MANIFEST: "xy_manifest",         // 版本清单（更新用，当前线上那条）
  MANIFEST_HISTORY: "xy_manifest_h", // 版本历史（回滚用，最多 30 条）
  BLOCK_PREFIX: "xy_blk_",         // 数据块前缀，后面接 sha256（见 block.js）
  NOTICES: "xy_notices",           // 公告列表
  STORES: "xy_stores",             // 门店档案（含开通码）
  BACKUP_INDEX: "xy_backup_index", // 各店备份索引
  SEEDED: "xy_seeded",             // 初始化标记
};

// 首次部署时写入的初始密码 —— **故意用一次性口令，逼着第一次登录就改掉**
const INITIAL_PASS = "xy" + "2026init";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

export function fail(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

/** OPTIONS 预检（浏览器直接调 API 必需）。 */
export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

/** 读取后台密码；KV 里没有就落一份初始口令。 */
export async function getAdminPass(kv) {
  let p = await kv.get(KEYS.ADMIN_PASS);
  if (!p) {
    p = INITIAL_PASS;
    await kv.put(KEYS.ADMIN_PASS, p);
  }
  return p;
}

/**
 * 校验后台请求。
 * 密码放请求头 x-admin-pass，不放 query —— query 会被写进 Cloudflare 访问日志。
 */
export async function requireAdmin(request, kv) {
  const pass = request.headers.get("x-admin-pass") || "";
  const saved = await getAdminPass(kv);
  return pass && pass === saved;
}

/** 读 JSON 数组，坏数据当空数组处理（别让一条脏数据把整个站点搞挂）。 */
export async function getList(kv, key) {
  try {
    const v = await kv.get(key, "json");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function putList(kv, key, list) {
  await kv.put(key, JSON.stringify(list));
}

/** 生成短随机串，用作开通码这类凭证。 */
export function randomCode(len = 8) {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";  // 去掉易混淆的 0O1I
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function nowIso() {
  return new Date().toISOString();
}

/**
 * 简单的字符串 SHA-256（WebCrypto）。
 * 更新包签名验证与备份去重都用得上。
 */
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 门店档案结构（注释即文档，后台也照这个展示） */
export function makeStore(phone, name) {
  return {
    id: "st" + Date.now().toString(36) + randomCode(4).toLowerCase(),
    phone,                       // 手机号 = 门店身份
    name: name || "",            // 门店名（方便你认人）
    code: randomCode(8),         // 开通码，一次性
    codeUsed: false,             // 用掉就作废，防止冒用
    activatedAt: null,           // 门店首次注册时间
    lastSeen: null,              // 门店最近一次联系服务器
    note: "",
    createdAt: nowIso(),
  };
}
