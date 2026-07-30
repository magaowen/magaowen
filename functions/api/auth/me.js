// GET  /api/auth/me   获取当前用户
// PUT  /api/auth/me   修改资料 {name?} 或改密 {oldPassword,newPassword}
import { json, readBody } from "../../_lib/util.js";
import { getUsers, saveUsers } from "../../_lib/db.js";
import { getUserByToken, authToken, hashPassword, makeSession, destroySession, publicUser } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const u = await getUserByToken(ctx.env, authToken(ctx.request));
  if (!u) return json({ ok: false, error: "未登录" }, 401);
  return json({ ok: true, user: publicUser(u) });
}

export async function onRequestPut(ctx) {
  const env = ctx.env;
  const token = authToken(ctx.request);
  const u = await getUserByToken(env, token);
  if (!u) return json({ ok: false, error: "未登录" }, 401);

  const b = await readBody(ctx.request);
  const users = await getUsers(env);
  const me = users.find(x => x.id === u.id);
  if (!me) return json({ ok: false, error: "用户不存在" }, 404);

  // 改密码
  if (b.newPassword) {
    if (!b.oldPassword) return json({ ok: false, error: "请填写原密码" }, 400);
    const oldH = await hashPassword(b.oldPassword, me.salt || "");
    if (oldH !== me.passHash) return json({ ok: false, error: "原密码错误" }, 401);
    if (b.newPassword.length < 6) return json({ ok: false, error: "新密码至少 6 位" }, 400);
    me.passHash = await hashPassword(b.newPassword, me.salt || "");
  }
  // 改昵称
  if (b.name && b.name.trim()) me.name = b.name.trim();

  await saveUsers(env, users);
  if (b.newPassword) {
    await destroySession(env, token);
    const newToken = await makeSession(env, me.id);
    return json({ ok: true, token: newToken, user: publicUser(me), changedPassword: true });
  }
  return json({ ok: true, user: publicUser(me) });
}
