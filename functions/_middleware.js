// 全局中间件：CORS 预检 + 响应头
import { CORS } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, next } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }
  const res = await next();
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-headers", "*");
  h.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}
