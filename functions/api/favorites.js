// GET    /api/favorites        我的收藏（返回宠物对象）
// POST   /api/favorites        {petId} 添加
// DELETE /api/favorites?petId= 取消
import { json, readBody } from "../_lib/util.js";
import { getPets, getFavs, saveFavs } from "../_lib/db.js";
import { getUserByToken, authToken } from "../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  const ids = await getFavs(env, user.id);
  const pets = await getPets(env);
  const list = ids.map(id => pets.find(p => p.id === id)).filter(Boolean);
  return json({ ok: true, favorites: list });
}

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  const b = await readBody(ctx.request);
  const petId = b.petId;
  if (!petId) return json({ ok: false, error: "缺少 petId" }, 400);
  const ids = await getFavs(env, user.id);
  if (!ids.includes(petId)) ids.push(petId);
  await saveFavs(env, user.id, ids);
  return json({ ok: true, favorites: ids });
}

export async function onRequestDelete(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);
  const petId = new URL(ctx.request.url).searchParams.get("petId");
  let ids = await getFavs(env, user.id);
  ids = ids.filter(id => id !== petId);
  await saveFavs(env, user.id, ids);
  return json({ ok: true, favorites: ids });
}
