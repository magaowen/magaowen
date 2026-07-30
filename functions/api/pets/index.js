// GET  /api/pets            公开列表（仅 active）；管理员可 ?status= 过滤；?mine=1 我的发布；?type=sell|want
// POST /api/pets            任意登录用户发布（status=pending），type=sell|want
import { json, readBody } from "../../_lib/util.js";
import { getPets, savePets } from "../../_lib/db.js";
import { getUserByToken, authToken, publicUser } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const url = new URL(ctx.request.url);
  const status = url.searchParams.get("status") || "active";
  const type = url.searchParams.get("type") || "";        // sell | want
  const mine = url.searchParams.get("mine") === "1";
  const user = await getUserByToken(env, authToken(ctx.request));

  let pets = await getPets(env);

  if (mine) {
    if (!user) return json({ ok: false, error: "请先登录" }, 401);
    pets = pets.filter(p => p.sellerId === user.id);
  } else if (user && user.type === "admin") {
    if (status && status !== "all") pets = pets.filter(p => p.status === status);
  } else {
    pets = pets.filter(p => p.status === "active");
  }
  if (type) pets = pets.filter(p => p.type === type);

  pets.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return json({ ok: true, pets });
}

export async function onRequestPost(ctx) {
  const env = ctx.env;
  const user = await getUserByToken(env, authToken(ctx.request));
  if (!user) return json({ ok: false, error: "请先登录" }, 401);

  const b = await readBody(ctx.request);
  const p = b.pet || b;
  const type = p.type === "want" ? "want" : "sell";
  const name = (p.name || "").trim();
  const province = (p.province || "").trim();
  const city = (p.city || "").trim();
  const category = (p.category || "").trim();
  const contact = (p.contact || "").trim();
  if (!name || !province || !city || !category || !contact)
    return json({ ok: false, error: "请填写标题、省份、城市、分类、联系方式" }, 400);

  const now = new Date().toISOString();
  const pet = {
    id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type,
    name,
    province,
    city,
    district: (p.district || "").trim(),
    category,
    breed: (p.breed || "").trim(),
    age: (p.age || "").trim(),
    gender: p.gender || "",
    vaccine: (p.vaccine || "").trim(),
    price: (p.price || "").toString().trim(),
    budget: (p.budget || "").toString().trim(),
    contact,
    desc: (p.desc || "").trim(),
    screenshots: Array.isArray(p.screenshots) ? p.screenshots.filter(Boolean) : [],
    mainShot: p.mainShot || (Array.isArray(p.screenshots) && p.screenshots[0]) || "",
    sellerId: user.id,
    sellerPhone: user.phone,
    sellerName: user.name,
    status: "pending",
    rejectReason: "",
    createdAt: now,
    updatedAt: now,
    views: 0
  };

  const pets = await getPets(env);
  pets.push(pet);
  await savePets(env, pets);
  return json({ ok: true, pet });
}
