// ⚠️ 一次性清空函数：删除 MY_KV 命名空间全部键。校验管理员后执行，用完即删。
export async function onRequestPost({ request, env }) {
  const h = request.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const ct = { "content-type": "application/json; charset=utf-8" };
  if (!token) return new Response(JSON.stringify({ ok: false, error: "no token" }), { status: 401, headers: ct });
  const sess = await env.MY_KV.get("sess:" + token, "json");
  if (!sess) return new Response(JSON.stringify({ ok: false, error: "bad token" }), { status: 401, headers: ct });
  const users = (await env.MY_KV.get("users", "json")) || [];
  const me = users.find(u => u.id === sess.userId && u.type === "admin");
  if (!me) return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403, headers: ct });

  let cursor = undefined, count = 0;
  do {
    const r = await env.MY_KV.list(cursor ? { cursor } : {});
    for (const k of r.keys) { await env.MY_KV.delete(k.name); count++; }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);

  return new Response(JSON.stringify({ ok: true, cleared: true, keysRemoved: count }), { status: 200, headers: ct });
}
