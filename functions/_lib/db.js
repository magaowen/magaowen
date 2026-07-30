// KV 数据访问层：宠物 / 用户 / 分类 / 收藏 / 预约
import { hashPassword, genSalt } from "./auth.js";

export async function kvGet(env, key, fallback) {
  const v = await env.MY_KV.get(key, "json");
  return v === null || v === undefined ? fallback : v;
}
export async function kvPut(env, key, val) {
  await env.MY_KV.put(key, JSON.stringify(val));
}

const STATUSES = ["pending", "active", "rejected", "offline"];

export function normalizePet(p) {
  if (!p) return p;
  return {
    ...p,
    status: STATUSES.includes(p.status) ? p.status : "active",
    screenshots: Array.isArray(p.screenshots) ? p.screenshots : [],
    views: p.views || 0,
    price: p.price || "",
    contact: p.contact || "",
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || p.createdAt || new Date().toISOString()
  };
}

// 读取宠物列表（首次自动从旧 softwares 迁移）
export async function getPets(env) {
  let pets = await kvGet(env, "pets", null);
  if (pets === null) {
    const old = await kvGet(env, "softwares", null);
    pets = (old || []).map(normalizePet);
    await kvPut(env, "pets", pets);
  } else {
    pets = pets.map(normalizePet);
  }
  return pets;
}
export async function savePets(env, pets) {
  await kvPut(env, "pets", pets);
}

// 用户：首次自动播种管理员账号（phone=admin / pass=123456）
export async function getUsers(env) {
  let users = await kvGet(env, "users", null);
  if (!users) {
    const salt = genSalt();
    const admin = {
      id: "u_admin",
      phone: "admin",
      name: "管理员",
      passHash: await hashPassword("123456", salt),
      salt,
      type: "admin",
      status: "active",
      createdAt: new Date().toISOString()
    };
    users = [admin];
    await kvPut(env, "users", users);
  }
  return users;
}
export async function saveUsers(env, users) {
  await kvPut(env, "users", users);
}

// 收藏（每个用户独立 key）
export async function getFavs(env, userId) {
  return (await kvGet(env, "favs:" + userId, [])) || [];
}
export async function saveFavs(env, userId, ids) {
  await kvPut(env, "favs:" + userId, ids);
}
export async function getApps(env, userId) {
  return (await kvGet(env, "apps:" + userId, [])) || [];
}
export async function saveApps(env, userId, list) {
  await kvPut(env, "apps:" + userId, list);
}
