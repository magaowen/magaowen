// ============================================================================
//  门店数据远程备份 API
//  路由：
//    POST /api/backup   —— 门店上传一份加密备份
//    GET  /api/backup   —— 后台列出所有门店的备份（需密码）
//    GET  /api/backup?storeId=xx            门店列自己的
//    GET  /api/backup?storeId=xx&file=xxx   下载一份（需后台密码，或门店本人带 storeId）
//    DELETE /api/backup —— 后台删某份（需密码）
//
//  **数据是加密后再上传的，云端只有密文** —— 这样即使 KV 被人翻到，
//  也看不到会员姓名、手机号、余额。密钥在门店本地，丢了这份云备份也就读不了。
//
//  KV 限制：
//    单值上限 25 MB，单键累计 1000 次写入/天、删除 1000 次/天。
//    所以：备份文件本身放 KV（每个 key 一个文件），索引单独一个 key。
//    门店 400KB 左右的库，压缩后约 100 KB，够放 200+ 份。
//
//  KV 键：
//    xy_backup_index = [{ storeId, file, size, createdAt, localVersion, note }]
//    xy_bak_<storeId>_<timestamp> = 二进制备份内容
// ============================================================================

import {
  KEYS, json, fail, preflight, requireAdmin,
  getList, putList, nowIso,
} from "./_lib.js";

const MAX_SIZE = 20 * 1024 * 1024;        // 20 MB，给 KV 25MB 上限留余量
const KEEP_PER_STORE = 30;                // 每家店最多留多少份，超了自动删最老的

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();
  if (!kv) return fail("服务器未绑定数据库（MY_KV）", 500);

  const url = new URL(request.url);

  // ================= 上传 =================
  if (method === "POST") {
    const storeId = (url.searchParams.get("storeId") || "").trim();
    if (!storeId) return fail("缺少 storeId");

    // 门店必须先注册过才能备份
    const stores = await getList(kv, KEYS.STORES);
    if (!stores.some(s => s.id === storeId)) return fail("门店未登记", 403);

    const contentType = request.headers.get("content-type") || "";
    const buf = await request.arrayBuffer();

    if (!buf.byteLength) return fail("备份内容为空");
    if (buf.byteLength > MAX_SIZE) {
      return fail(`备份太大（${(buf.byteLength / 1048576).toFixed(1)} MB），超过 20 MB 上限`);
    }

    // 文件名必须带随机段：只精确到秒的话，同一秒连传两份会生成同名 key 互相覆盖，
    // 表现为「刚传的备份立刻消失」。随机段用 crypto 保证不重复。
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
    const rand = [...crypto.getRandomValues(new Uint8Array(4))]
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const file = `${storeId}_${stamp}_${rand}.bin`;

    try {
      await kv.put(`xy_bak_${file}`, buf, {
        // 备份数据不该进缓存（要拿最新，且涉及会员隐私）
        expirationTtl: 60 * 60 * 24 * 400,
      });
    } catch (e) {
      return fail("云端写入失败：" + (e && e.message ? e.message : "未知错误"), 500);
    }

    const all = await getList(kv, KEYS.BACKUP_INDEX);
    all.push({
      storeId,
      file,
      size: buf.byteLength,
      createdAt: nowIso(),
      localVersion: (request.headers.get("x-client-version") || "").slice(0, 20),
      sha256: (request.headers.get("x-checksum") || "").slice(0, 64),
      contentType: contentType.slice(0, 60),
      note: "",
    });

    // 只保留该店最新 N 份，超了删老的（连带删 KV 内容）
    let index = all;
    const mine = all.filter(b => b.storeId === storeId);
    if (mine.length > KEEP_PER_STORE) {
      const drop = mine.slice(0, mine.length - KEEP_PER_STORE);
      for (const d of drop) {
        try { await kv.delete(`xy_bak_${d.file}`); } catch { /* 忽略 */ }
      }
      const dropSet = new Set(drop.map(d => d.file));
      index = all.filter(b => !dropSet.has(b.file));
    }

    await putList(kv, KEYS.BACKUP_INDEX, index);

    const total = index.filter(b => b.storeId === storeId).length;
    return json({
      ok: true,
      file,
      size: buf.byteLength,
      total,
      kept: total,
      message: `已备份（第 ${total}/${KEEP_PER_STORE} 份）`,
    });
  }

  // ================= 下载 / 列出 =================
  if (method === "GET") {
    const storeId = (url.searchParams.get("storeId") || "").trim();
    const file = (url.searchParams.get("file") || "").trim();
    const isAdmin = await requireAdmin(request, kv);

    // 下载具体某份：要么后台，要么门店本人（凭 storeId）
    if (file) {
      const index = await getList(kv, KEYS.BACKUP_INDEX);
      const item = index.find(b => b.file === file);
      if (!item) return fail("备份不存在", 404);

      // 门店本人要证明 storeId 是自己的：比对已登记列表
      if (!isAdmin) {
        if (!storeId || item.storeId !== storeId) return fail("无权下载这份备份", 403);
        const stores = await getList(kv, KEYS.STORES);
        if (!stores.some(s => s.id === storeId)) return fail("门店未登记", 403);
      }

      const data = await kv.get(`xy_bak_${file}`, "arrayBuffer");
      if (!data) return fail("备份内容已丢失", 404);

      const name = file.replace(/^[^_]+_/, "") + ".db";
      return new Response(data, {
        headers: {
          ...{
            "access-control-allow-origin": "*",
            "content-type": "application/octet-stream",
            "content-disposition": `attachment; filename="${name}"`,
          },
        },
      });
    }

    // 列清单
    const index = await getList(kv, KEYS.BACKUP_INDEX);
    const stores = await getList(kv, KEYS.STORES);

    if (storeId && !isAdmin) {
      return json({ ok: true, backups: index.filter(b => b.storeId === storeId) });
    }

    // ⚠️ 这里必须先卡住：**不是后台、又没给 storeId** 说明是想看全局列表。
    //
    // 以前这段直接往下走"后台视角"，把全部门店的名字、手机号、在线状态、
    // 上次同步时间原样返回 —— 等于任何人不带密码就能拿到你的客户名单。
    // 现在没数据时看不出来，等真登记了门店就全泄露了。
    if (!isAdmin) return fail("后台密码错误", 401);

    // 后台视角：按门店分组，带门店信息与总占用
    const groups = stores.map(s => {
      const items = index.filter(b => b.storeId === s.id);
      return {
        storeId: s.id,
        storeName: s.name || "(未填门店名)",
        phone: s.phone,
        activated: !!s.codeUsed,
        lastSeen: s.lastSeen,
        lastAction: s.lastAction,
        version: s.version || "",
        count: items.length,
        totalBytes: items.reduce((a, b) => a + (b.size || 0), 0),
        latest: items.length ? items[items.length - 1].createdAt : null,
        backups: items.slice().reverse(),
      };
    });

    return json({
      ok: true,
      groups,
      totalBackups: index.length,
      totalBytes: index.reduce((a, b) => a + (b.size || 0), 0),
      keepPerStore: KEEP_PER_STORE,
    });
  }

  // ================= 删（后台） =================
  if (method === "DELETE") {
    if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

    let body = {};
    try { body = await request.json(); } catch { /* 空体 */ }

    if (body.file) {
      try { await kv.delete(`xy_bak_${body.file}`); } catch { /* 忽略 */ }
      const index = await getList(kv, KEYS.BACKUP_INDEX);
      await putList(kv, KEYS.BACKUP_INDEX, index.filter(b => b.file !== body.file));
      return json({ ok: true, message: "已删除" });
    }

    // 清掉某店全部备份
    const index = await getList(kv, KEYS.BACKUP_INDEX);
    for (const b of index.filter(x => x.storeId === body.storeId)) {
      try { await kv.delete(`xy_bak_${b.file}`); } catch { /* 忽略 */ }
    }
    await putList(kv, KEYS.BACKUP_INDEX, index.filter(b => b.storeId !== body.storeId));
    return json({ ok: true, message: "该店备份已全部删除" });
  }

  return fail("方法不支持", 405);
}
