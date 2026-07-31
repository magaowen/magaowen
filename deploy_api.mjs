// deploy_api.mjs —— 把 software-hub 全部文件推到仓库根目录触发 Cloudflare 自动构建
// 运行：node deploy_api.mjs （在 software-hub 目录内）
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// GitHub Token 从环境变量读取，避免明文写入仓库（GitHub 推送保护会拦截）
const TOKEN = process.env.GH_TOKEN || "";
if (!TOKEN) {
  console.error("缺少环境变量 GH_TOKEN，请先设置：set GH_TOKEN=ghp_xxx 再运行");
  process.exit(1);
}
const REPO = "magaowen/magaowen";
const API = "https://api.github.com";
const HEADERS = {
  Authorization: "Bearer " + TOKEN,
  Accept: "application/vnd.github+json",
  "User-Agent": "wb-deploy",
  "Content-Type": "application/json",
};

// 递归收集项目内所有需部署的文件（排除 .git / node_modules）
const SKIP = new Set([".git", "node_modules"]);
function walk(dir, base = "") {
  let out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const rel = base ? base + "/" + name : name;
    if (statSync(full).isDirectory()) out = out.concat(walk(full, rel));
    else out.push(rel);
  }
  return out;
}

const files = walk(".").sort();

async function gh(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let j = {};
  try { j = JSON.parse(txt); } catch (e) {}
  if (!res.ok)
    throw new Error(method + " " + path + " -> " + res.status + " " + (j.message || txt.slice(0, 200)));
  return j;
}

try {
  const repo = await gh("GET", `/repos/${REPO}`);
  console.log("REPO_OK  homepage=" + (repo.homepage || "(未设置)") + "  default_branch=" + repo.default_branch);

  const ref = await gh("GET", `/repos/${REPO}/git/refs/heads/main`);
  const baseSha = ref.object.sha;
  const baseCommit = await gh("GET", `/repos/${REPO}/git/commits/${baseSha}`);
  const baseTree = baseCommit.tree.sha;

  const tree = [];
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    const b = await gh("POST", `/repos/${REPO}/git/blobs`, { content, encoding: "utf-8" });
    tree.push({ path: f, mode: "100644", type: "blob", sha: b.sha });
    console.log("  blob ok:", f, "(", content.length, "chars )");
  }

  const newTree = await gh("POST", `/repos/${REPO}/git/trees`, { base_tree: baseTree, tree });
  const newCommit = await gh("POST", `/repos/${REPO}/git/commits`, {
    message: "deploy: software-hub 真实后端 (Cloudflare KV + Functions)",
    tree: newTree.sha,
    parents: [baseSha],
  });
  await gh("PATCH", `/repos/${REPO}/git/refs/heads/main`, { sha: newCommit.sha });

  console.log("DEPLOY_PUSHED_OK " + newCommit.sha);
  if (repo.homepage) console.log("LIVE_URL " + repo.homepage);
} catch (e) {
  console.error("DEPLOY_FAILED: " + e.message);
  process.exit(1);
}
