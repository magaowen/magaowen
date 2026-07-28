// Cloudflare Pages Function - 软件数据 API
// 绑定 KV 命名空间时，变量名填 MY_KV
// 路由：/api/softwares  （GET 公开读，POST/PUT/DELETE 需密码）

const DEFAULT_PASS = "123456";

const SEED = [
  {
    id: "demo-player",
    name: "影音播放器 Demo",
    icon: "🎬",
    desc: "轻量级本地影音播放器。这是示例，请在后台改成你自己的软件。",
    category: "影音",
    version: "v3.2.0",
    size: "86 MB",
    updated: "2026-07-20",
    screenshots: [
      "https://picsum.photos/seed/app1/800/500",
      "https://picsum.photos/seed/app2/800/500"
    ],
    downloads: {
      pc: "https://example.com/dl/pc",
      android: "https://example.com/dl/android",
      mac: "https://example.com/dl/mac"
    }
  }
];

export async function onRequest(ctx) {
  const request = ctx.request;
  const method = (request.method || "GET").toUpperCase();
  const MY_KV = ctx.env.MY_KV;  // Cloudflare: 通过 context.env 访问 KV

  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS"
  };

  if (method === "OPTIONS") return new Response(null, { headers });

  // ===== GET：公开读取列表 =====
  if (method === "GET") {
    let list = await MY_KV.get("softwares", "json");
    if (!list) {
      list = SEED;
      await MY_KV.put("softwares", JSON.stringify(SEED));
    }
    return new Response(JSON.stringify(list), { headers });
  }

  // ===== 以下写操作均需密码 =====
  let body = {};
  try { body = await request.json(); } catch (e) {}

  const pass = request.headers.get("x-admin-pass") || body.password || "";
  const savedPass = (await MY_KV.get("admin_pass")) || DEFAULT_PASS;
  if (pass !== savedPass) {
    return new Response(JSON.stringify({ ok: false, error: "密码错误" }), { status: 401, headers });
  }

  let list = (await MY_KV.get("softwares", "json")) || [];

  if (method === "PUT" && body.action === "changepass") {
    await MY_KV.put("admin_pass", body.newpass || DEFAULT_PASS);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  if (method === "POST") {
    const item = body.software || {};
    item.id = item.id || ("s" + Date.now());
    list.push(item);
    await MY_KV.put("softwares", JSON.stringify(list));
    return new Response(JSON.stringify({ ok: true, item }), { headers });
  }

  if (method === "PUT") {
    const idx = list.findIndex(s => s.id === body.id);
    if (idx >= 0) {
      list[idx] = Object.assign({}, list[idx], body.software || {});
      await MY_KV.put("softwares", JSON.stringify(list));
    }
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  if (method === "DELETE") {
    list = list.filter(s => s.id !== body.id);
    await MY_KV.put("softwares", JSON.stringify(list));
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(JSON.stringify({ ok: false, error: "方法不支持" }), { status: 405, headers });
}
