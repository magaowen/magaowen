// GET    /api/pets/:id   详情（公开仅看 active；本人/管理员看任意）
// PUT    /api/pets/:id   编辑（本人可改任意状态；管理员可改）
// DELETE /api/pets/:id   删除（管理员或本人）
import { json, readBody } from "../../_lib/util.js";
import { getPets, savePets } from "../../_lib/db.js";
import { getUserByToken, authToken } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const id = ctx.params.id;
  const user = await getUserByToken(env, authToken(ctx.request));
  const pets = await getPets(env);
  const pet = pets.find(p => p.id === id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);
  if (pet.status !== "active" && !(user && (user.id === pet.sellerId || user.type === "admin")))
    return json({ ok: false, error: "该宠物未在售" }, 403);

  // 浏览量 +1（仅公开 active 访问）
  if (pet.status === "active") {
    pet.views = (pet.views || 0) + 1;
    await savePets(env, pets);
  }
  return json({ ok: true, pet });
}

export async function onRequestPut(ctx) {
  const env = ctx.env;
  const id = ctx.params.id;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);

  const pets = await getPets(env);
  const pet = pets.find(p => p.id === id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);
  if (user.type !== "admin" && user.id !== pet.sellerId)
    return json({ ok: false, error: "无权操作" }, 403);

  const b = await readBody(ctx.request);
  const p = b.pet || b;
  const fields = ["name", "province", "city", "district", "category", "breed", "age", "gender", "vaccine", "price", "contact", "desc", "screenshots", "mainShot"];
  fields.forEach(f => { if (p[f] !== undefined) pet[f] = p[f]; });
  if (Array.isArray(pet.screenshots) && !pet.mainShot) pet.mainShot = pet.screenshots[0] || "";
  pet.updatedAt = new Date().toISOString();
  await savePets(env, pets);
  return json({ ok: true, pet });
}

export async function onRequestDelete(ctx) {
  const env = ctx.env;
  const id = ctx.params.id;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);

  const pets = await getPets(env);
  const pet = pets.find(p => p.id === id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);
  if (user.type !== "admin" && user.id !== pet.sellerId)
    return json({ ok: false, error: "无权删除" }, 403);

  const next = pets.filter(p => p.id !== id);
  await savePets(env, next);
  return json({ ok: true });
}
