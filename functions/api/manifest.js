// ============================================================================
//  版本清单 API
//  路由：GET /api/manifest   —— 客户端查有没有新版本（公开读）
//        PUT /api/manifest   —— 后台发布新版本（需后台密码）
//        POST /api/manifest  —— 后台操作（回滚 / 下线）（需后台密码）
//
//  更新是怎么做到只传几百 KB 的：
//    门店本地已经有 100 多 MB 运行时，其中真正会变的只有 XiaoyuMember.dll。
//    所以更新包 = **文件清单 + 每个文件切成 64 KB 的块**。
//    块按内容哈希命名存进 /api/block（内容寻址，跨版本自动去重）。
//    客户端拿清单，先比对本地文件算出的块哈希，**一样的块直接从本地文件里取**，
//    只下载不一样的块 —— 一次改几个功能的更新通常只有几百 KB。
//
//  KV 键：
//    xy_manifest  = 当前线上清单（单条）
//    xy_manifest_h= 版本历史（数组，保留最近 30 条，回滚用）
//    xy_blk_xxx   = 数据块（在 block.js 里）
//
//  清单结构：
//    {
//      version, releasedAt, notes, mandatory,
//      files: [{ name, size, sha256, blocks: ["h1","h2",...] }],   // 可多个文件
//      targets: { mode:"all"|"test"|"selected", phones:[...], testPhones:[...] },
//      installer: { name, size, sha256, url } | null,
//      publishedBy
//    }
// ============================================================================

import { KEYS, json, fail, preflight, requireAdmin, nowIso } from "./_lib.js";

const BLOCK_DEFAULT = 64 * 1024;
const HEX64 = /^[0-9a-f]{64}$/;
const HISTORY_MAX = 30;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();

  // ================= 客户端查更新 =================
  if (method === "GET") return handleGet(request, kv);

  // ================= 后台专用：完整视图（含推送对象，客户端看不到）=================
  if (method === "PATCH") {
    if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);
    const manifest = await kv.get(KEYS.MANIFEST, "json");
    return json({ ok: true, manifest: manifest || null });
  }

  // ================= 以下都要后台密码 =================
  if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

  let body = {};
  try { body = await request.json(); } catch { /* 空体当 {} */ }

  if (method === "PUT") return handlePublish(kv, body);
  if (method === "POST") return handleAction(kv, body);
  if (method === "DELETE") return handleOffline(kv);

  return fail("方法不支持", 405);
}

// ---------------------------------------------------------------------------
//  客户端查更新
// ---------------------------------------------------------------------------
async function handleGet(request, kv) {
  const q = new URL(request.url).searchParams;
  const current = q.get("current") || "";
  const phone = q.get("phone") || "";         // 门店手机号（决定推给不推给它）
  const channel = q.get("channel") || "prod"; // prod / test

  let manifest = null;
  try { manifest = await kv.get(KEYS.MANIFEST, "json"); } catch { /* 读失败当没有 */ }

  if (!manifest || !manifest.version || !Array.isArray(manifest.files) || !manifest.files.length) {
    return json({ ok: true, hasUpdate: false, current, message: "服务器还没有发布任何版本" });
  }

  // ---- 推送目标筛选：这个版本发不发给你 ----
  const targets = manifest.targets || { mode: "all" };
  if (!isTargeted(targets, phone, channel)) {
    return json({
      ok: true, hasUpdate: false, current,
      version: manifest.version,
      message: targets.mode === "selected" ? "本次更新未推送给你" : "本次更新面向其他版本线",
    });
  }

  // ---- 版本号比较：1.0.10 要比 1.0.9 新，不能直接比字符串 ----
  const hasUpdate = compareVersion(manifest.version, current) > 0;

  return json({
    ok: true,
    hasUpdate,
    current,
    version: manifest.version,
    releasedAt: manifest.releasedAt,
    notes: manifest.notes || "",
    mandatory: !!manifest.mandatory,
    blockSize: manifest.blockSize || BLOCK_DEFAULT,
    files: manifest.files.map(slimFile),   // 只给客户端用得上的字段
    installer: manifest.installer || null,
    publishedBy: manifest.publishedBy || "",
  });
}

/** 清单里的文件去掉后台专用字段。 */
function slimFile(f) {
  return { name: f.name, size: f.size, sha256: f.sha256, blocks: f.blocks || [] };
}

/** 这个版本推不推给这台机器。 */
function isTargeted(targets, phone, channel) {
  const mode = targets.mode || "all";
  if (mode === "all") return true;

  if (mode === "selected") {
    // 指定名单：没带手机号（老版本客户端）就当推给了，保证兼容
    if (!phone) return true;
    return Array.isArray(targets.phones) && targets.phones.includes(phone);
  }

  if (mode === "test") {
    // 只推测试组：测试组名单优先；没配名单时看通道是不是 test
    const list = Array.isArray(targets.testPhones) ? targets.testPhones : [];
    if (list.length) return phone ? list.includes(phone) : true;
    return channel === "test";
  }

  return true;
}

/** 逐段比数字：1.0.10 > 1.0.9。返回 -1/0/1。 */
function compareVersion(a, b) {
  const pa = String(a || "0").split(/[.\-+]/);
  const pb = String(b || "0").split(/[.\-+]/);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const na = parseInt(pa[i] ?? "0", 10) || 0;
    const nb = parseInt(pb[i] ?? "0", 10) || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
//  后台发布新版本
// ---------------------------------------------------------------------------
async function handlePublish(kv, body) {
  const version = (body.version || "").trim();
  if (!version) return fail("请填版本号");

  const inFiles = Array.isArray(body.files) ? body.files : [];
  if (!inFiles.length) return fail("没有可发布的文件");

  // ---- 校验文件清单 ----
  for (const f of inFiles) {
    if (!f || !f.name) return fail("文件清单里有缺文件名的项");
    // 防目录穿越：清单里的名字必须是相对路径，不能有 .. 或盘符
    const n = String(f.name).replace(/\\/g, "/");
    if (n.startsWith("/") || /^[a-z]:/i.test(n) || n.includes(".."))
      return fail(`文件名非法：${f.name}`);
    if (!Array.isArray(f.blocks) || !f.blocks.length)
      return fail(`文件 ${f.name} 没有数据块`);
    if (f.sha256 && !HEX64.test(String(f.sha256)))
      return fail(`文件 ${f.name} 的 sha256 格式不对`);
  }

  const blockSize = body.blockSize || BLOCK_DEFAULT;

  // ---- 先存块（内容寻址：已有的块不重复写）----
  let written = 0, reused = 0;
  for (const f of inFiles) {
    const chunks = Array.isArray(f.chunks) ? f.chunks : [];
    for (let i = 0; i < f.blocks.length; i++) {
      const h = f.blocks[i];
      if (!HEX64.test(h)) return fail(`数据块哈希格式不对：${h}`);
      const data = chunks[i];
      if (typeof data !== "string" || !data.length)
        return fail(`数据块 ${h} 缺少内容（清单与块数不一致？）`);

      const key = "xy_blk_" + h;
      const exists = await kv.get(key);
      if (exists) { reused++; continue; }     // 同样的内容存过了，跳过

      await kv.put(key, data);
      written++;
    }
  }

  // ---- 写清单（去掉 chunks，别把内容又塞回清单里）----
  const manifest = {
    version,
    releasedAt: nowIso(),
    notes: String(body.notes || "").slice(0, 2000),
    mandatory: !!body.mandatory,
    blockSize,
    files: inFiles.map(f => ({
      name: String(f.name).replace(/\\/g, "/"),
      size: Number(f.size) || 0,
      sha256: String(f.sha256 || ""),
      blocks: f.blocks,
    })),
    targets: normalizeTargets(body.targets),
    installer: body.installer || null,
    publishedBy: body.publishedBy || "后台",
  };

  // ---- 旧版本进历史，方便回滚 ----
  let history = [];
  try { history = (await kv.get(KEYS.MANIFEST_HISTORY, "json")) || []; } catch { }
  if (!Array.isArray(history)) history = [];

  const old = await kv.get(KEYS.MANIFEST, "json");
  // 同一个版本号重发（客户端超时后重试、或补传一次）不该再记一条历史 ——
  // 否则历史里会攒出一串一模一样的版本号，回滚时根本分不清哪条是哪个。
  if (old && old.version && old.version !== version) {
    history.unshift({
      version: old.version,
      releasedAt: old.releasedAt,
      notes: old.notes || "",
      mandatory: !!old.mandatory,
      blockSize: old.blockSize || BLOCK_DEFAULT,
      files: old.files || [],
      targets: old.targets || { mode: "all" },
      installer: old.installer || null,
      publishedBy: old.publishedBy || "",
    });
    history = history.slice(0, HISTORY_MAX);
    await kv.put(KEYS.MANIFEST_HISTORY, JSON.stringify(history));
  }

  await kv.put(KEYS.MANIFEST, JSON.stringify(manifest));

  return json({
    ok: true,
    written, reused,
    version,
    blocks: inFiles.reduce((s, f) => s + f.blocks.length, 0),
    historyCount: history.length,
  });
}

function normalizeTargets(t) {
  if (!t || typeof t !== "object") return { mode: "all" };
  const mode = ["all", "test", "selected"].includes(t.mode) ? t.mode : "all";
  return {
    mode,
    phones: Array.isArray(t.phones) ? t.phones.filter(Boolean).map(String) : [],
    testPhones: Array.isArray(t.testPhones) ? t.testPhones.filter(Boolean).map(String) : [],
  };
}

// ---------------------------------------------------------------------------
//  后台操作：回滚 / 下线 / 历史
// ---------------------------------------------------------------------------
async function handleAction(kv, body) {
  const action = (body.action || "").trim();

  if (action === "history") {
    let history = [];
    try { history = (await kv.get(KEYS.MANIFEST_HISTORY, "json")) || []; } catch { }
    if (!Array.isArray(history)) history = [];
    return json({ ok: true, history: history.map(h => ({
      version: h.version, releasedAt: h.releasedAt, notes: h.notes || "",
      mandatory: !!h.mandatory, publishedBy: h.publishedBy || "",
      fileCount: (h.files || []).length,
      totalSize: (h.files || []).reduce((s, f) => s + (Number(f.size) || 0), 0),
    })) });
  }

  // 清空历史。做测试时一天能发十几个版本，历史里全是 0.0.x-test，
  // 真版本反而找不着 —— 给个清掉的口子。**只删历史，不动线上清单**。
  if (action === "clearHistory") {
    await kv.delete(KEYS.MANIFEST_HISTORY);
    return json({ ok: true, message: "历史已清空（线上版本未动）" });
  }

  if (action === "rollback") {
    const ver = (body.version || "").trim();
    if (!ver) return fail("请指定要回到哪个版本");

    let history = [];
    try { history = (await kv.get(KEYS.MANIFEST_HISTORY, "json")) || []; } catch { }
    if (!Array.isArray(history)) history = [];

    const hit = history.find(h => h.version === ver);
    if (!hit) return fail(`历史里没有 ${ver}`);

    // 被回滚掉的当前版本也存进历史，将来还能滚回去
    const cur = await kv.get(KEYS.MANIFEST, "json");
    if (cur && cur.version && cur.version !== ver) {
      history = [{
        version: cur.version, releasedAt: cur.releasedAt, notes: cur.notes || "",
        mandatory: !!cur.mandatory, blockSize: cur.blockSize || BLOCK_DEFAULT,
        files: cur.files || [], targets: cur.targets || { mode: "all" },
        installer: cur.installer || null, publishedBy: cur.publishedBy || "",
      }, ...history].slice(0, HISTORY_MAX);
    }

    const restored = { ...hit, releasedAt: hit.releasedAt, rolledBackTo: ver };
    await kv.put(KEYS.MANIFEST, JSON.stringify(restored));
    await kv.put(KEYS.MANIFEST_HISTORY, JSON.stringify(history.slice(0, HISTORY_MAX)));

    return json({ ok: true, message: `已回滚到 ${ver}`, version: ver });
  }

  return fail("未知操作：" + action);
}

async function handleOffline(kv) {
  const cur = await kv.get(KEYS.MANIFEST, "json");
  if (cur && cur.version) {
    let history = [];
    try { history = (await kv.get(KEYS.MANIFEST_HISTORY, "json")) || []; } catch { }
    if (!Array.isArray(history)) history = [];
    history = [{
      version: cur.version, releasedAt: cur.releasedAt, notes: cur.notes || "",
      mandatory: !!cur.mandatory, blockSize: cur.blockSize || BLOCK_DEFAULT,
      files: cur.files || [], targets: cur.targets || { mode: "all" },
      installer: cur.installer || null, publishedBy: cur.publishedBy || "",
    }, ...history].slice(0, HISTORY_MAX);
    await kv.put(KEYS.MANIFEST_HISTORY, JSON.stringify(history));
  }

  await kv.delete(KEYS.MANIFEST);
  return json({ ok: true, message: "已下线（当前清单已清空，已存进历史可随时回滚）" });
}
