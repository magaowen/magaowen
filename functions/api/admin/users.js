// GET  /api/admin/users        用户列表
// POST /api/admin/users        {userId, action, value?}  ban/unban/setRole
import { json, readBody } from "../../_lib/util.js";
import { getUsers, saveUsers } from "../../_lib/db.js";
import { requireAdmin, authToken, publicUser } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);
  const users = await getUsers(env);
  const list = users
    .map(publicUser)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return json({ ok: true, users: list });
}

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);

  const b = await readBody(ctx.request);
  const userId = b.userId;
  const action = b.action;
  const users = await getUsers(env);
  const u = users.find(x => x.id === userId);
  if (!u) return json({ ok: false, error: "用户不存在" }, 404);
  if (u.type === "admin") return json({ ok: false, error: "不能操作管理员" }, 400);

  if (action === "ban") u.status = "banned";
  else if (action === "unban") u.status = "active";
  else if (action === "setRole") {
    if (!["buyer", "seller"].includes(b.value)) return json({ ok: false, error: "角色无效" }, 400);
    u.type = b.value;
  } else return json({ ok: false, error: "操作未知" }, 400);

  await saveUsers(env, users);
  return json({ ok: true, user: publicUser(u) });
}
