// 鉴权：密码哈希、会话 token、当前用户
const PEPPER = "pet-share-2026";

export async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(pw, salt) {
  return sha256((salt || "") + "::" + pw + "::" + PEPPER);
}

export function genSalt() {
  return crypto.randomUUID().slice(0, 8);
}

// 创建会话，返回 token（7 天过期）
export async function makeSession(env, userId) {
  const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  await env.MY_KV.put("sess:" + token, JSON.stringify({ userId, createdAt: Date.now() }), {
    expirationTtl: 60 * 60 * 24 * 7
  });
  return token;
}

export async function destroySession(env, token) {
  if (token) await env.MY_KV.delete("sess:" + token);
}

// 从请求头取当前登录用户（含封禁判断）
export async function getUserByToken(env, token) {
  if (!token) return null;
  const s = await env.MY_KV.get("sess:" + token, "json");
  if (!s || !s.userId) return null;
  const users = (await env.MY_KV.get("users", "json")) || [];
  const u = users.find(x => x.id === s.userId && x.status !== "banned");
  return u || null;
}

export function authToken(request) {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

// 必须是管理员，否则返回 null
export async function requireAdmin(env, token) {
  const u = await getUserByToken(env, token);
  return u && u.type === "admin" ? u : null;
}

// 必须已登录，否则 null
export async function requireUser(env, token) {
  return getUserByToken(env, token);
}

// 去除敏感字段
export function publicUser(u) {
  if (!u) return null;
  const { passHash, salt, ...rest } = u;
  return rest;
}
