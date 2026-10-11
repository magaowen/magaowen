// ============================================================================
//  门店身份与注册校验 API
//  路由：
//    POST /api/stores   action=activate  —— 门店首次激活：只要手机号登记过就放行
//                                action=heartbeat —— 激活后心跳（顺带查更新）
//    GET  /api/stores   —— 后台看门店列表（需密码）
//    POST /api/stores   —— 后台登记门店（需密码）
//    PUT  /api/stores   —— 后台改门店名/备注（需密码）
//    DELETE /api/stores —— 后台删门店（需密码）
//
//  激活凭什么：
//    2026-10-11 马文拍板**去掉开通码**，只认手机号 —— 后台登记过这个号，
//    门店就能激活。简单、少一步操作，代价是没有凭证：
//    知道门店手机号的人就能激活一套。所以限流（同 IP 5 分钟 10 次）留着，
//    防的是拿号段批量试探"哪些门店在用"。
//
//  单机版 / 联网版：同一手机号下**有没有登记带序号的分机**（+01/+02…）。
//    没有 → 单机版；有 → 联网版（多机共享业务数据）。由这里判定后回给客户端。
//
//  KV 键：xy_stores = [{ id, phone, seq, name, machineId, activatedAt, lastSeen, ... }]
// ============================================================================

import {
  KEYS, json, fail, preflight, requireAdmin,
  getList, putList, makeStore, nowIso,
  findStore, loginOf, normalizeSeq, isMultiMachine,
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
  const machine = String(body.machineId || "").slice(0, 64);

  if (!phone) return fail("请填写手机号");
  if (!/^1[3-9]\d{9}$/.test(phone)) return fail("手机号格式不对（应为 11 位）");

  const rawSeq = String(body.seq ?? "").trim();
  if (rawSeq && rawSeq !== "00" && !/^\d{2}$/.test(rawSeq))
    return fail("序号应为两位数字，如 01（主台留空）");
  const seq = normalizeSeq(rawSeq);

  // 限流：同一 IP 5 分钟内失败 10 次就拒。
  // ⚠️ 去掉开通码之后这一层变重要了 —— 否则可以拿号段批量试探，
  //    把"哪些手机号登记过"（= 有哪些门店在用）扫出来。
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = "xy_rl_" + ip;
  const rl = await kv.get(rlKey, "json");
  if (rl && rl.count >= 10 && Date.now() - rl.at < 300000) {
    return fail("尝试次数过多，请 5 分钟后再试", 429);
  }

  const stores = await getList(kv, KEYS.STORES);

  // 激活只认手机号：**这个号登记过就放行**（2026-10-11 去掉开通码）。
  // 优先对上「手机号+序号」那条记录；没登记过这个序号就落到该手机号的主记录，
  // 免得门店自己加第二台机时、因为后台没登记那个序号而激活不了。
  const mine = stores.filter(s => s.phone === phone);
  if (!mine.length) {
    await bumpRate(kv, rlKey, rl);
    return fail("手机号未登记，请联系软件提供方", 403);
  }

  const s = findStore(stores, phone, seq)
         || mine.find(x => !normalizeSeq(x.seq))
         || mine[0];

  const firstTime = !s.activatedAt;
  s.activatedAt = s.activatedAt || nowIso();
  s.lastSeen = nowIso();
  s.lastAction = firstTime ? "首次激活" : "重新激活（重装或换机）";
  if (machine) s.machineId = machine;

  await putList(kv, KEYS.STORES, stores);
  await kv.delete(rlKey);

  return json({
    ok: true,
    storeId: s.id,
    name: s.name || "",
    phone,
    seq: seq || null,
    // 回客户端实际填的那个登录号（可能带序号），省得它自己拼
    loginAccount: seq ? `${phone}+${seq}` : phone,
    // 多机门店 = 联网版；单机门店 = 单机版。**由云端判定**，不听客户端的。
    onlineMode: isMultiMachine(stores, phone),
    reused: !firstTime,
    message: firstTime ? "激活成功" : "已重新激活",
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

/** 后台看到的门店信息。 */
function publicView(s) {
  return {
    id: s.id,
    phone: s.phone,
    seq: s.seq || null,          // "01"/"02"…；主台为 null
    loginAccount: loginOf(s),    // 13812345678 或 13812345678+01
    name: s.name,
    machineId: s.machineId || "",
    activatedAt: s.activatedAt,  // 有值 = 已激活
    lastSeen: s.lastSeen,
    lastAction: s.lastAction || "",
    version: s.version || "",
    note: s.note || "",
    createdAt: s.createdAt,
  };
}
