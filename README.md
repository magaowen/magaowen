# 小鱼会员管理 · 云端服务

门店会员管理软件的云端服务代码，跑在 Cloudflare Pages（免费）。

| 地址 | 用途 |
|---|---|
| https://soft-share.pages.dev | 门店下载页 |
| https://soft-share.pages.dev/admin.html | 管理后台（初始密码 `xy2026init`） |

## 提供的功能

- **在线更新** —— 客户端启动时查一次，只下载变化的块（几百 KB，不是 126 MB）
- **公告** —— 轮播公告（工作台顶部，按天自动结束）+ 强制公告（每人登录弹一次）
- **门店注册** —— 手机号 + 一次性开通码，防止冒用
- **数据远程备份** —— 门店数据加密后上传，每店保留 30 份

## 目录

```
index.html              门店下载页
admin.html              管理后台
wrangler.toml           Cloudflare 配置（KV 绑定）
functions/api/
  _lib.js               公共模块（KV 键名、鉴权、工具）
  manifest.js           版本清单（更新用）
  notices.js            公告
  stores.js             门店注册与心跳
  backup.js             数据备份
  admin.js              后台专用（改密码/清理/导出）
files/                  门店下载的安装包放这里
test_api.mjs            本地验证（node test_api.mjs）
部署说明.md             完整操作手册
```

## KV 数据键

| 键 | 内容 |
|---|---|
| `xy_admin_pass` | 后台密码 |
| `xy_manifest` | 版本清单（分块哈希 + 签名） |
| `xy_notices` | 公告列表 |
| `xy_stores` | 门店档案（含开通码） |
| `xy_backup_index` | 备份索引 |
| `xy_bak_<文件>` | 备份内容（**密文**） |

## 重要

- **分目录发布是更新能省流量的前提**。发布配置千万别改回 `PublishSingleFile`，
  合成单文件后二进制每次几乎全变，增量更新会失效。
- 后台密码初始是 `xy2026init`，**首次登录必须改掉**。
- 备份内容是加密后才上传的，云端只有密文，密钥在门店本地。
