// GET    /api/categories   公开分类列表
// POST   /api/categories   {name} 新增（管理员）
// DELETE /api/categories   {name} 删除（管理员）
import { json, readBody } from "../_lib/util.js";
import { kvGet, kvPut } from "../_lib/db.js";
import { requireAdmin, authToken } from "../_lib/auth.js";

const DEFAULT_CATS = ["猫咪出售", "狗狗出售", "免费领养", "宠物用品", "宠物配种", "上门喂养", "宠物寄养", "异宠小宠", "寻宠启事", "养宠知识"];

export async function onRequestGet(ctx) {
  const env = ctx.env;
  let cats = await kvGet(env, "categories", null);
  if (!cats || !cats.length) {
    cats = DEFAULT_CATS;
    await kvPut(env, "categories", cats);
  }
  return json(cats);
}

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);
  const b = await readBody(ctx.request);
  const name = (b.name || "").trim();
  if (!name) return json({ ok: false, error: "分类名不能为空" }, 400);
  let cats = (await kvGet(env, "categories", null)) || DEFAULT_CATS;
  if (cats.includes(name)) return json({ ok: false, error: "分类已存在" }, 409);
  cats.push(name);
  await kvPut(env, "categories", cats);
  return json({ ok: true, cats });
}

export async function onRequestDelete(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);
  const b = await readBody(ctx.request);
  const name = (b.name || "").trim();
  let cats = (await kvGet(env, "categories", null)) || DEFAULT_CATS;
  cats = cats.filter(c => c !== name);
  await kvPut(env, "categories", cats);
  return json({ ok: true, cats });
}
