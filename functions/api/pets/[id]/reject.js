// POST /api/pets/:id/reject   {reason?} 管理员拒绝 → rejected
import { json, readBody } from "../../../_lib/util.js";
import { getPets, savePets } from "../../../_lib/db.js";
import { requireAdmin, authToken } from "../../../_lib/auth.js";

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限，需管理员账号" }, 403);

  const b = await readBody(ctx.request);
  const pets = await getPets(env);
  const pet = pets.find(p => p.id === ctx.params.id);
  if (!pet) return json({ ok: false, error: "未找到该宠物" }, 404);

  pet.status = "rejected";
  pet.rejectReason = (b.reason || "信息不符，未通过审核").trim();
  pet.updatedAt = new Date().toISOString();
  await savePets(env, pets);
  return json({ ok: true, pet });
}
