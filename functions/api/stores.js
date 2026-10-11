// ============================================================================
//  门店身份与注册校验 API
//  路由：
//    POST /api/stores   action=activate  —— 门店首次注册：手机号 + 开通码
//                                action=heartbeat —— 注册后心跳（顺带查更新）
//    GET  /api/stores   —— 后台看门店列表（需密码）
//    POST /api/stores   —— 后台新增门店（需密码）
//    PUT  /api/stores   —— 后台改门店 / 重发开通码（需密码）
//    DELETE /api/stores —— 后台删门店（需密码）
//
//  为什么要开通码，不能只凭手机号：
//    手机号写在收银台旁边、被人看到、店员转发……只凭手机号谁都能注册管理员。
//    手机号是**身份**，开通码是**凭证**，用掉即作废。
//
//  限流：同一 IP 的失败尝试记在 KV，5 分钟内失败 10 次就拒。
//    KV 没有原子计数，够用即可（防的是随手试，不是专业攻击）。
//
//  KV 键：xy_stores = [{ id, phone, name, code, codeUsed, activatedAt, lastSeen, note }]
// ============================================================================

import {
  KEYS, json, fail, preflight, requireAdmin,
  getList, putList, makeStore, nowIso,
  findStore, loginOf, normalizeSeq,
} from "./_lib.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();

  // ================= 客户端（门店软件） =================
  // 只有「不带后台密码头」的请求才算客户端 —— 后台页面也会用 POST 登记门店，
  // 如果只看 method 就一律当客户端，后台就登记不了门店了。
  const hasAdminPass = !!(request.headers.get("x-admin-pass") || "");

  if (method === "POST" && !hasAdminPass) {
    let body = {};
    try { body = await request.json(); } catch { return fail("请求格式错误"); }

    const action = body.action || "activate";

    if (action === "activate") return await activate(kv, request, body);
    if (action === "heartbeat") return await heartbeat(kv, body);

    return fail("未知操作");
  }

  // ================= 以下需后台密码 =================
  if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

  const stores = await getList(kv, KEYS.STORES);

  if (method === "GET") {
    return json({ ok: true, stores: stores.map(publicView) });
  }

  let body = {};
  try { body = await request.json(); } catch { /* 空体 */ }

  // 后台新增门店 → 生成开通码
  //   seq 留空 = 主台（第一台）；填 01/02… = 同一门店的第 N 台电脑。
  //   唯一性按 (手机号, 序号) 判 —— 同一个手机号可以有 +01 / +02 多条。
  if (method === "POST") {
    const phone = String(body.phone || "").trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) return fail("手机号格式不对（应为 11 位）");

    const rawSeq = String(body.seq ?? "").trim();
    if (rawSeq && rawSeq !== "00" && !/^\d{2}$/.test(rawSeq))
      return fail("序号应为两位数字，如 01（主台留空）");
    const seq = normalizeSeq(rawSeq);

    if (findStore(stores, phone, seq))
      return fail(seq ? `这个手机号的 ${seq} 号机已经登记过了` : "这个手机号的主台已经登记过了");

    const s = makeStore(phone, (body.name || "").trim(), seq);
    if (body.note) s.note = String(body.note).slice(0, 500);

    stores.push(s);
    await putList(kv, KEYS.STORES, stores);
    return json({ ok: true, store: publicView(s) });
  }

  if (method === "PUT") {
    const s = stores.find(x => x.id === body.id);
    if (!s) return fail("门店不存在");

    if (body.name !== undefined) s.name = String(body.name).slice(0, 100);
    if (body.note !== undefined) s.note = String(body.note).slice(0, 500);

    // 重新发开通码：旧码作废
    if (body.newCode) {
      const { randomCode } = await import("./_lib.js");
      s.code = randomCode(8);
      s.codeUsed = false;
      s.activatedAt = null;
    }

    await putList(kv, KEYS.STORES, stores);
    return json({ ok: true, store: publicView(s) });
  }

  if (method === "DELETE") {
    const rest = stores.filter(s => s.id !== body.id);
    await putList(kv, KEYS.STORES, rest);
    return json({ ok: true });
  }

  return fail("方法不支持", 405);
}

// ---------------- 门店首次注册 ----------------

async function activate(kv, request, body) {
  const phone = String(body.phone || "").trim();
  const seq = normalizeSeq(body.seq);
  const code = String(body.code || "").trim().toUpperCase();
  const machine = String(body.machineId || "").slice(0, 64);

  if (!phone || !code) return fail("请填写手机号与开通码");
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail("手机号格式不对（应为 11 位）");

  // 限流：同一 IP 5 分钟内失败 10 次就拒
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = "xy_rl_" + ip;
  const rl = await kv.get(rlKey, "json");
  if (rl && rl.count >= 10 && Date.now() - rl.at < 300000) {
    return fail("尝试次数过多，请 5 分钟后再试", 429);
  }

  const stores = await getList(kv, KEYS.STORES);
  const s = findStore(stores, phone, seq);

  if (!s) {
    await bumpRate(kv, rlKey, rl);
    return fail(seq ? `手机号 ${phone}+${seq} 未登记，请联系软件提供方`
                    : "手机号未登记，请联系软件提供方", 403);
  }

  if (s.codeUsed) {
    // 码已用过：只有同一台机器再来才放行（门店重装/换电脑后自己恢复）
    if (machine && s.machineId === machine) {
      s.lastSeen = nowIso();
      s.lastAction = "重新注册（同机器）";
      await putList(kv, KEYS.STORES, stores);
      await kv.delete(rlKey);
      return json({ ok: true, storeId: s.id, name: s.name, phone: s.phone,
                    seq: s.seq || null, loginAccount: loginOf(s), reused: true });
    }
    await bumpRate(kv, rlKey, rl);
    return fail("开通码已使用过。如需换电脑，请联系软件提供方重发。", 403);
  }

  if (s.code !== code) {
    await bumpRate(kv, rlKey, rl);
    return fail("开通码不正确", 403);
  }

  // 通过：码一次性作废
  s.codeUsed = true;
  s.activatedAt = nowIso();
  s.lastSeen = nowIso();
  s.lastAction = "首次激活";
  if (machine) s.machineId = machine;

  await putList(kv, KEYS.STORES, stores);
  await kv.delete(rlKey);

  return json({
    ok: true,
    storeId: s.id,
    name: s.name,
    phone: s.phone,
    seq: s.seq || null,
    loginAccount: loginOf(s),      // 客户端拿它做登录号，省得自己拼
    message: "注册成功",
  });
}

// ---------------- 注册后心跳 ----------------

async function heartbeat(kv, body) {
  const id = String(body.storeId || "");
  if (!id) return fail("缺少 storeId");

  const stores = await getList(kv, KEYS.STORES);
  const s = stores.find(x => x.id === id);
  if (!s) return fail("门店未登记", 403);

  s.lastSeen = nowIso();
  s.lastAction = (body.action || "心跳").slice(0, 40);
  if (body.version) s.version = String(body.version).slice(0, 20);

  await putList(kv, KEYS.STORES, stores);

  // ⚠️ 这里**不再**带 manifest 回去。
  // 以前这里是单文件时代的字段（fileName / signature / blocks），跟现在的多文件清单
  // （files[] / blockSize / targets）对不上，客户端也从没读过它 —— 留着只会误导。
  // 查更新统一走 GET /api/manifest（那边才有推送目标筛选）。
  return json({
    ok: true,
    serverTime: nowIso(),
    notice: s.note || "",              // 你给门店留的备注（比如"该续费了"）
    storeName: s.name || "",
    loginAccount: loginOf(s),
  });
}

// ---------------- 小工具 ----------------

async function bumpRate(kv, key, prev) {
  const fresh = prev && Date.now() - prev.at < 300000;
  await kv.put(key, JSON.stringify({
    count: fresh ? prev.count + 1 : 1,
    at: Date.now(),
  }));
}

/** 后台看到的门店信息（含开通码，方便你复制发给门店）。 */
function publicView(s) {
  return {
    id: s.id,
    phone: s.phone,
    seq: s.seq || null,          // "01"/"02"…；主台为 null
    loginAccount: loginOf(s),    // 13812345678 或 13812345678+01
    name: s.name,
    code: s.code,
    codeUsed: !!s.codeUsed,
    machineId: s.machineId || "",
    activatedAt: s.activatedAt,
    lastSeen: s.lastSeen,
    lastAction: s.lastAction || "",
    version: s.version || "",
    note: s.note || "",
    createdAt: s.createdAt,
  };
}
