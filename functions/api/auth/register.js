// POST /api/auth/register  {phone, password, name?, role?}
import { json, readBody } from "../../_lib/util.js";
import { getUsers, saveUsers } from "../../_lib/db.js";
import { hashPassword, genSalt, makeSession, publicUser } from "../../_lib/auth.js";

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const b = await readBody(ctx.request);
  const phone = (b.phone || "").trim();
  const pw = b.password || "";
  const role = b.role === "seller" ? "seller" : "buyer";
  const name = (b.name || "").trim() || (role === "seller" ? "宠物卖家" : "宠友");

  if (!/^1\d{10}$/.test(phone)) return json({ ok: false, error: "请输入正确的 11 位手机号" }, 400);
  if (pw.length < 6) return json({ ok: false, error: "密码至少 6 位" }, 400);
  if (phone === "admin") return json({ ok: false, error: "该手机号已被占用" }, 400);

  const users = await getUsers(env);
  if (users.find(u => u.phone === phone)) return json({ ok: false, error: "该手机号已注册" }, 409);

  const salt = genSalt();
  const user = {
    id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    phone,
    name,
    passHash: await hashPassword(pw, salt),
    salt,
    type: role,
    status: "active",
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await saveUsers(env, users);

  const token = await makeSession(env, user.id);
  return json({ ok: true, token, user: publicUser(user) });
}
