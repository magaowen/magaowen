// ============================================================================
//  更新清单 API
//  路由：GET /api/manifest   —— 客户端启动时调一次，拿最新版本与分块清单
//  鉴权：读取公开（客户端要能读），写入需后台密码
//
//  为什么是分块：
//    客户端本地已有 148 MB 运行时，其中只有 XiaoyuMember.dll 会变。
//    服务端存这个文件的分块哈希列表，客户端逐块比对本地，
//    相同的块直接复用本地内容，只下载不同的块 —— 更新只花几百 KB。
//
//  KV 键：
//    xy_manifest = {
//      version, releasedAt, notes, mandatory,
//      blockSize,                      // 64 KB
//      blocks: ["hash1","hash2",...],  // 按顺序，长度 = 文件块数
//      fileSize, fileName, sha256,
//      signature,                      // 后台签名，防篡改
//      installer: { name, size, sha256, url }   // 完整安装包（首次安装 / 修复用）
//    }
// ============================================================================

import { KEYS, CORS, json, fail, preflight, requireAdmin, randomCode, nowIso } from "./_lib.js";

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const kv = env.MY_KV;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();

  // ---------------- 读：客户端查更新 ----------------
  if (method === "GET") {
    const url = new URL(request.url);
    const cur = url.searchParams.get("current") || "";

    let manifest = null;
    try {
      manifest = await kv.get(KEYS.MANIFEST, "json");
    } catch { /* KV 读失败当没有 */ }

    if (!manifest) {
      return json({
        ok: true,
        hasUpdate: false,
        message: "服务器还没有发布任何版本",
        current: cur,
      });
    }

    const hasUpdate = !!manifest.version && cur !== manifest.version;

    return json({
      ok: true,
      hasUpdate,
      current: cur,
      version: manifest.version,
      releasedAt: manifest.releasedAt,
      notes: manifest.notes || "",
      mandatory: !!manifest.mandatory,      // true = 必须更新才能继续用
      blockSize: manifest.blockSize || 65536,
      blocks: manifest.blocks || [],
      fileName: manifest.fileName || "XiaoyuMember.dll",
      fileSize: manifest.fileSize || 0,
      fileSha256: manifest.sha256 || "",
      signature: manifest.signature || "",
      installer: manifest.installer || null,
    });
  }

  // ---------------- 以下写操作需后台密码 ----------------
  if (!await requireAdmin(request, kv)) return fail("后台密码错误", 401);

  let body = {};
  try { body = await request.json(); } catch { /* 空体当 {} */ }

  // 发布新版本：后台已算好分块哈希，直接存
  if (method === "PUT" || method === "POST") {
    const version = (body.version || "").trim();
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];

    if (!version) return fail("请填版本号");
    if (!blocks.length) return fail("请先上传更新包并生成块清单");

    const manifest = {
      version,
      releasedAt: nowIso(),
      notes: (body.notes || "").slice(0, 2000),
      mandatory: !!body.mandatory,
      blockSize: body.blockSize || 65536,
      blocks,
      fileName: body.fileName || "XiaoyuMember.dll",
      fileSize: body.fileSize || 0,
      sha256: body.sha256 || "",
      signature: body.signature || randomCode(24),   // 没签名就随机一个占位，客户端会拒收
      installer: body.installer || null,
      publishedBy: body.publishedBy || "后台",
    };

    await kv.put(KEYS.MANIFEST, JSON.stringify(manifest));
    return json({ ok: true, manifest });
  }

  // 下线：把清单删掉，客户端就查不到更新了
  if (method === "DELETE") {
    await kv.delete(KEYS.MANIFEST);
    return json({ ok: true, message: "已下线（清单已清空）" });
  }

  return fail("方法不支持", 405);
}
