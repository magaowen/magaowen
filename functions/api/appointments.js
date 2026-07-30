// GET  /api/appointments   我的预约（含宠物信息）
// POST /api/appointments   {petId, note?} 发起预约看宠
import { json, readBody } from "../_lib/util.js";
import { getPets, getApps, saveApps } from "../_lib/db.js";
import { getUserByToken, authToken } from "../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  const apps = await getApps(env, user.id);
  const pets = await getPets(env);
  const list = apps.map(a => ({ ...a, pet: pets.find(p => p.id === a.petId) || null }));
  return json({ ok: true, appointments: list });
}

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  const b = await readBody(ctx.request);
  const petId = b.petId;
  if (!petId) return json({ ok: false, error: "缺少 petId" }, 400);
  const pets = await getPets(env);
  const pet = pets.find(p => p.id === petId);
  if (!pet) return json({ ok: false, error: "宠物不存在" }, 404);

  const apps = await getApps(env, user.id);
  const exist = apps.find(a => a.petId === petId && a.status !== "cancelled");
  if (exist) return json({ ok: false, error: "已预约过该宠物" }, 409);

  apps.push({
    id: "a" + Date.now().toString(36),
    petId,
    note: (b.note || "").trim(),
    status: "pending",
    createdAt: new Date().toISOString()
  });
  await saveApps(env, user.id, apps);
  return json({ ok: true, appointment: { ...apps[apps.length - 1], pet } });
}
