// GET  /api/admin/users        用户列表（含注册时间、发帖数）
// POST /api/admin/users        {userId, action}  ban / unban / promote / demote / delete
import { json, readBody } from "../../_lib/util.js";
import { getUsers, saveUsers, getPets, savePets } from "../../_lib/db.js";
import { requireAdmin, authToken, publicUser } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);
  const users = await getUsers(env);
  const pets = await getPets(env);
  const list = users.map(u => {
    const pu = publicUser(u);
    pu.petCount = pets.filter(p => p.sellerId === u.id).length;
    return pu;
  }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
  if (u.type === "admin" && action !== "demote") return json({ ok: false, error: "不能操作管理员" }, 400);

  if (action === "ban") u.status = "banned";
  else if (action === "unban") u.status = "active";
  else if (action === "promote") {
    if (u.type === "admin") return json({ ok: false, error: "已是管理员" }, 400);
    u.type = "admin";
  } else if (action === "demote") {
    if (u.id === admin.id) return json({ ok: false, error: "不能取消自己的管理员权限" }, 400);
    u.type = "user";
  } else if (action === "delete") {
    if (u.type === "admin") return json({ ok: false, error: "不能删除管理员" }, 400);
    // 删除用户及其所有发布
    const pets = await getPets(env);
    const filtered = pets.filter(p => p.sellerId !== userId);
    await savePets(env, filtered);
    const idx = users.indexOf(u);
    if (idx > -1) users.splice(idx, 1);
    await saveUsers(env, users);
    return json({ ok: true, message: "已删除" });
  } else return json({ ok: false, error: "操作未知" }, 400);

  await saveUsers(env, users);
  return json({ ok: true, user: publicUser(u) });
}
