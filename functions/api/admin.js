// ============================================================================
//  后台专用 API
//  路由：POST /api/admin
//    action=changepass  改后台密码
//    action=cleanOld    清理软件分享站时期的旧数据
//    action=export      导出全部数据（搬家/备份用）
//
//  全部需后台密码。
// ============================================================================

import {
  KEYS, json, fail, preflight, requireAdmin,
  getList, putList, getAdminPass, nowIso,
} from "./_lib.js";

// 软件分享站时期用过的键，确认没在用就删掉
const OLD_KEYS = ["softwares", "categories", "data"];

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();
  if (method === "GET") {
    return json({
      ok: true,
      serverTime: nowIso(),
      keys: ["manifest", "notices", "stores", "backup"],
      note: "这是小鱼会员管理的云端服务，不是软件分享站",
    });
  }

  if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

  let body = {};
  try { body = await request.json(); } catch { /* 空体 */ }
  const action = body.action || "";

  // ---------------- 改密码 ----------------
  if (action === "changepass") {
    const p = String(body.newpass || "").trim();
    if (p.length < 6) return fail("新密码至少 6 位");
    if (p === "123456" || p === "xy2026init") return fail("这个密码太弱了，换一个");

    await kv.put(KEYS.ADMIN_PASS, p);
    return json({ ok: true, message: "密码已修改" });
  }

  // ---------------- 清理旧数据 ----------------
  if (action === "cleanOld") {
    const removed = [];
    for (const k of OLD_KEYS) {
      try {
        const v = await kv.get(k);
        if (v !== null) { await kv.delete(k); removed.push(k); }
      } catch { /* 忽略单个失败 */ }
    }
    return json({
      ok: true,
      removed,
      message: removed.length
        ? `已清理：${removed.join("、")}`
        : "没有找到旧数据，本来就是干净的",
    });
  }

  // ---------------- 导出全部 ----------------
  if (action === "export") {
    const stores = await getList(kv, KEYS.STORES);
    const notices = await getList(kv, KEYS.NOTICES);
    const backups = await getList(kv, KEYS.BACKUP_INDEX);
    let manifest = null;
    try { manifest = await kv.get(KEYS.MANIFEST, "json"); } catch { /* 无 */ }

    return json({
      ok: true,
      exportedAt: nowIso(),
      data: { stores, notices, backups, manifest },
    });
  }

  return fail("未知操作");
}
