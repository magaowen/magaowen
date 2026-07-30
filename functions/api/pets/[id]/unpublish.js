// POST /api/pets/:id/unpublish   下架 → offline（管理员或本人）
import { json, readBody } from "../../../_lib/util.js";
import { getPets, savePets } from "../../../_lib/db.js";
import { getUserByToken, authToken } from "../../../_lib/auth.js";

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);

  const pets = await getPets(env);
  const pet = pets.find(p => p.id === ctx.params.id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);
  if (user.type !== "admin" && user.id !== pet.sellerId)
    return json({ ok: false, error: "无权操作" }, 403);

  pet.status = "offline";
  pet.updatedAt = new Date().toISOString();
  await savePets(env, pets);
  return json({ ok: true, pet });
}
