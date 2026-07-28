// Cloudflare Pages Function - 分类管理 API
// GET /api/categories → 公开读取
// POST /api/categories → 新增分类（需密码）
// DELETE /api/categories → 删除分类（需密码）

const DEFAULT_CATS = ["工具","社交","影音","办公","系统","开发","教育","游戏","设计","安全"];
const DEFAULT_PASS = "123456";

export async function onRequest(ctx) {
  const request = ctx.request;
  const method = (request.method || "GET").toUpperCase();
  const MY_KV = ctx.env.MY_KV; // Cloudflare KV 绑定

  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
  };

  if (method === "OPTIONS") return new Response(null, { headers });

  // GET: 公开读
  if (method === "GET") {
    let cats = await MY_KV.get("categories", "json");
    if (!cats) { cats = DEFAULT_CATS; await MY_KV.put("categories", JSON.stringify(DEFAULT_CATS)); }
    return new Response(JSON.stringify(cats), { headers });
  }

  // 写操作需密码
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const pass = request.headers.get("x-admin-pass") || body.password || "";
  const savedPass = (await MY_KV.get("admin_pass")) || DEFAULT_PASS;
  if (pass !== savedPass) {
    return new Response(JSON.stringify({ ok: false, error: "密码错误" }), { status: 401, headers });
  }

  let cats = (await MY_KV.get("categories", "json")) || DEFAULT_CATS;

  // POST: 新增分类
  if (method === "POST") {
    const name = (body.name || "").trim();
    if (!name) return new Response(JSON.stringify({ ok: false, error: "分类名不能为空" }), { status: 400, headers });
    if (cats.includes(name)) return new Response(JSON.stringify({ ok: false, error: "分类已存在" }), { status: 409, headers });
    cats.push(name);
    await MY_KV.put("categories", JSON.stringify(cats));
    return new Response(JSON.stringify({ ok: true, cats }), { headers });
  }

  // DELETE: 删除分类
  if (method === "DELETE") {
    const name = (body.name || "").trim();
    cats = cats.filter(c => c !== name);
    await MY_KV.put("categories", JSON.stringify(cats));
    return new Response(JSON.stringify({ ok: true, cats }), { headers });
  }

  return new Response(JSON.stringify({ ok: false, error: "方法不支持" }), { status: 405, headers });
}
