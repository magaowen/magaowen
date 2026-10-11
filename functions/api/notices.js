// ============================================================================
//  公告 API
//  路由：GET /api/notices   —— 客户端拉公告
//        POST/PUT/DELETE   —— 后台发/改/删（需密码）
//
//  两种公告，**去重维度不同**（这是最容易做错的地方）：
//
//  ① 轮播公告（banner）
//     去重按「**电脑**」：这台电脑第一次看到公告时记下时间，播满设定天数自动收起。
//     换个人登录同一台电脑 → 算同一次播（他在同一台电脑上，不该重复播）
//
//  ② 强制公告（modal）
//     去重按「**操作员**」：每个人登录都弹一次，点「我知道了」才写记录，之后不再打扰
//
//  服务端不存去重记录（那是每台机器自己的事），只管发什么。
//  断网时客户端用本地缓存继续播 —— 所以公告内容要完整下发，客户端自己算剩余天数。
//
//  KV 键：xy_notices = [{ id, kind, title, body, days, releasedAt, pinned }]
// ============================================================================

import { KEYS, json, fail, preflight, requireAdmin, getList, putList, randomCode, nowIso } from "./_lib.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();

  // ---------------- 读：客户端拉公告 ----------------
  if (method === "GET") {
    const list = await getList(kv, KEYS.NOTICES);

    // 客户端带上 storeId / operatorId 只是为了日志统计，服务端不做去重
    const url = new URL(request.url);
    const storeId = url.searchParams.get("storeId") || "";
    if (storeId) await touchStore(kv, storeId, "拉取公告");

    return json({
      ok: true,
      notices: list
        .slice()
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
        .map(n => ({
          id: n.id,
          kind: n.kind,               // banner | modal
          title: n.title,
          body: n.body,
          days: n.days || 3,          // 轮播播几天（modal 忽略）
          releasedAt: n.releasedAt,
          pinned: !!n.pinned,
          author: n.author || "",
        })),
      serverTime: nowIso(),
    });
  }

  // ---------------- 以下需后台密码 ----------------
  if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

  let body = {};
  try { body = await request.json(); } catch { /* 空体 */ }

  const list = await getList(kv, KEYS.NOTICES);

  // 发公告
  if (method === "POST") {
    const title = (body.title || "").trim();
    const text = (body.body || "").trim();
    if (!title) return fail("请填公告标题");
    if (!text) return fail("请填公告内容");

    const kind = body.kind === "modal" ? "modal" : "banner";
    const days = Math.max(0, Math.min(365, parseInt(body.days, 10) || 3));

    const item = {
      id: "n" + Date.now().toString(36) + randomCode(3).toLowerCase(),
      kind,                        // banner = 工作台轮播；modal = 强制弹窗
      title,
      body: text,
      days: kind === "banner" ? days : 0,
      pinned: !!body.pinned,
      author: body.author || "马文",
      releasedAt: nowIso(),
    };

    list.push(item);
    await putList(kv, KEYS.NOTICES, list);
    return json({ ok: true, item });
  }

  // 改 / 下线
  if (method === "PUT") {
    const idx = list.findIndex(n => n.id === body.id);
    if (idx < 0) return fail("公告不存在");

    if (body.action === "offline") {
      list.splice(idx, 1);                       // 下线 = 移除
    } else {
      const n = list[idx];
      if (body.title !== undefined) n.title = body.title;
      if (body.body !== undefined) n.body = body.body;
      if (body.days !== undefined) n.days = Math.max(0, Math.min(365, parseInt(body.days, 10) || 0));
      if (body.pinned !== undefined) n.pinned = !!body.pinned;
      n.updatedAt = nowIso();
    }

    await putList(kv, KEYS.NOTICES, list);
    return json({ ok: true });
  }

  // 删
  if (method === "DELETE") {
    const rest = list.filter(n => n.id !== body.id);
    await putList(kv, KEYS.NOTICES, rest);
    return json({ ok: true });
  }

  return fail("方法不支持", 405);
}

/** 更新门店的最近联系时间（顺带做，失败不影响主流程）。 */
async function touchStore(kv, storeId, what) {
  try {
    const { getList, putList } = await import("./_lib.js");
    const stores = await getList(kv, KEYS.STORES);
    const s = stores.find(x => x.id === storeId);
    if (s) {
      s.lastSeen = nowIso();
      s.lastAction = what;
      await putList(kv, KEYS.STORES, stores);
    }
  } catch { /* 忽略 */ }
}
