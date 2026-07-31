// 全量同步本地 software-hub 目录到 GitHub 仓库，触发 Cloudflare Pages 重新构建
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO = 'magaowen/magaowen';
const BRANCH = 'main';
const ROOT = process.cwd();
const GH = process.env.GH_TOKEN;
if (!GH) { console.error('缺少 GH_TOKEN 环境变量'); process.exit(1); }
const H = { Authorization: `Bearer ${GH}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wb', 'Content-Type': 'application/json' };

const EXCLUDE = new Set(['.git', 'node_modules', '.workbuddy']);
const EXCLUDE_FILE = f => f === 'deploy_sync.mjs' || f.endsWith('.tmp');

function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name) || EXCLUDE_FILE(name)) continue;
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else if (st.isFile()) out.push(rel);
  }
  return out;
}

const api = async (method, path, body) => {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    method, headers: H, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`GitHub ${method} ${path} -> ${r.status}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
};

(async () => {
  const files = walk(ROOT);
  console.log('本地文件数:', files.length);

  // 当前分支引用与基础树
  const ref = await api('GET', `git/refs/heads/${BRANCH}`);
  const baseSha = ref.object.sha;
  const baseCommit = await api('GET', `git/commits/${baseSha}`);
  const baseTree = await api('GET', `git/trees/${baseCommit.tree.sha}?recursive=1`);
  const treeShaMap = {};
  for (const t of baseTree.tree) if (t.type === 'blob') treeShaMap[t.path] = t.sha;

  // 创建 blobs
  const entries = [];
  for (const f of files) {
    const content = readFileSync(join(ROOT, f));
    const b64 = content.toString('base64');
    const blob = await api('POST', 'git/blobs', { content: b64, encoding: 'base64' });
    entries.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 新树
  const tree = await api('POST', 'git/trees', { base_tree: baseCommit.tree.sha, tree: entries });
  // 提交
  const msg = 'fix: Bootstrap 23MB→KB(剥离fileData/图片) 修复点击消失+手机白屏 + 下载按需拉取完整文件';
  const commit = await api('POST', 'git/commits', { message: msg, tree: tree.sha, parents: [baseSha] });
  // 更新引用
  await api('PATCH', `git/refs/heads/${BRANCH}`, { sha: commit.sha });
  console.log('已推送提交:', commit.sha.slice(0, 8));
})().catch(e => { console.error('部署失败:', e.message); process.exit(1); });
