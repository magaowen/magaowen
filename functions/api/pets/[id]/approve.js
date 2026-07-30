// POST /api/pets/:id/approve   管理员审核通过 → active
import { json, readBody } from "../../../_lib/util.js";
import { getPets, savePets } from "../../../_lib/db.js";
import { requireAdmin, authToken } from "../../../_lib/auth.js";

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限，需管理员账号" }, 403);

  const pets = await getPets(env);
  const pet = pets.find(p => p.id === ctx.params.id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);

  pet.status = "active";
  pet.rejectReason = "";
  pet.updatedAt = new Date().toISOString();
  await savePets(env, pets);
  return json({ ok: true, pet });
}
