// ============================================================================
//  更新数据块 · 内容寻址存储
//  路由：GET /api/block?h=<sha256>
//
//  为什么单独一个路由：
//    客户端更新时先拿清单（哪些块变了），再用哈希逐块来取。
//    块按**内容哈希**命名，天然去重 —— 两个版本里一样的块只存一份，
//    存了十个版本也只多存真正改过的那些。
//
//  KV 键：xy_blk_<sha256> = 该块的 base64 内容
//  块大小固定 64 KB（见 manifest 的 blockSize），base64 后约 87 KB，
//  远小于 KV 单值 25 MB 上限。
//
//  鉴权：公开读。门店软件要能匿名下载。
//        写入不在这里做 —— 块由后台发布时经 /api/manifest 一并送上来。
// ============================================================================

import { CORS, json, fail, preflight } from "./_lib.js";

/** 块内容键名。哈希只允许十六进制，防止有人拿任意 key 探测 KV。 */
function blockKey(hash) {
  return "xy_blk_" + hash;
}

const HEX64 = /^[0-9a-f]{64}$/;

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const method = (request.method || "GET").toUpperCase();

  if (method === "OPTIONS") return preflight();
  if (method !== "GET") return fail("方法不支持", 405);

  const hash = new URL(request.url).searchParams.get("h") || "";
  if (!HEX64.test(hash)) return fail("块哈希格式不对", 400);

  let b64 = null;
  try {
    b64 = await env.MY_KV.get(blockKey(hash));
  } catch {
    return json({ ok: false, error: "服务器读块失败，请稍后重试" }, 500);
  }

  // 没有这一块：客户端会重新去要整包；返回 404 让它明确知道"缺块"而不是"网络断了"
  if (b64 === null) return json({ ok: false, error: "这一块服务器上没有，请重新下载安装包" }, 404);

  return json({
    ok: true,
    h: hash,
    size: Math.floor(b64.length * 3 / 4),   // base64 长度反推原始字节数（够用，不做精确解码）
    data: b64,
  });
}
