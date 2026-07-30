// GET /api/admin/stats   管理员统计
import { json } from "../../_lib/util.js";
import { getPets, getUsers } from "../../_lib/db.js";
import { requireAdmin, authToken } from "../../_lib/auth.js";

export async function onRequestGet(ctx) {
  const env = ctx.env;
  const admin = await requireAdmin(env, authToken(ctx.request));
  if (!admin) return json({ ok: false, error: "无权限" }, 403);

  const pets = await getPets(env);
  const users = await getUsers(env);
  const today = new Date().toISOString().slice(0, 10);
  const count = s => pets.filter(p => p.status === s).length;
  return json({
    ok: true,
    stats: {
      pending: count("pending"),
      active: count("active"),
      rejected: count("rejected"),
      offline: count("offline"),
      wants: pets.filter(p => p.type === "want" && p.status === "active").length,
      total: pets.length,
      users: users.length,
      admins: users.filter(u => u.type === "admin").length,
      todayNew: pets.filter(p => (p.createdAt || "").slice(0, 10) === today).length,
      todayUsers: users.filter(u => (u.createdAt || "").slice(0, 10) === today).length
    }
  });
}
