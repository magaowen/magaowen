// POST /api/auth/login  {phone, password}
import { json, readBody } from "../../_lib/util.js";
import { getUsers } from "../../_lib/db.js";
import { hashPassword, makeSession, publicUser } from "../../_lib/auth.js";

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const b = await readBody(ctx.request);
  const phone = (b.phone || "").trim();
  const pw = b.password || "";

  const users = await getUsers(env);
  const user = users.find(u => u.phone === phone);
  if (!user) return json({ ok: false, error: "用户不存在，请先注册" }, 404);
  if (user.status === "banned") return json({ ok: false, error: "账号已被封禁" }, 403);

  const h = await hashPassword(pw, user.salt || "");
  if (h !== user.passHash) return json({ ok: false, error: "密码错误" }, 401);

  const token = await makeSession(env, user.id);
  return json({ ok: true, token, user: publicUser(user) });
}
