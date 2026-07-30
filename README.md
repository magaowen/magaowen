# 全国宠物交易（PetShare）

同城宠物交易平台：买家浏览、卖家发布（审核后上架）、管理员审核与用户管理。
前端静态站 + Cloudflare Pages Functions + KV（`MY_KV` 绑定）。

## 角色与权限
- **买家**：公开浏览；收藏 / 预约看宠需登录（注册角色=买家）。
- **卖家**：必须注册登录；发布宠物进入「待审核」，管理员通过后「已上架」。
- **管理员**：账号 `admin` / 密码 `123456`；审核、下架、删除、用户封禁/改角色、分类管理、统计。

## 目录结构
```
site/
├── index.html        # 买家首页（公开浏览 + 城市/分类筛选）
├── detail.html       # 宠物详情（收藏/预约，需登录）
├── seller.html       # 卖家中心（强制登录：发布 + 我的发布状态）
├── mine.html         # 我的后台（资料/改密/收藏/预约/我的发布）
├── auth.html         # 登录 / 注册（买家/卖家）
├── admin.html        # 管理后台（审核流 + 用户管理 + 统计 + 分类）
├── common.js         # 公共前端库（主题/鉴权/API/城市数据/图片压缩）
├── data-areas.json   # 全国省/市/区县数据（34 省 2846 区县）
└── functions/        # Cloudflare Pages Functions（API）
    ├── _lib/         # util / auth / db 公共模块
    ├── _middleware.js# 全局 CORS
    └── api/
        ├── auth/     # register / login / me
        ├── pets/     # 列表/发布 + [id] 详情/编辑/删除 + approve/reject/unpublish
        ├── admin/    # stats / users
        ├── categories.js
        ├── favorites.js
        └── appointments.js
```

## 数据模型（KV）
- `users`：[{id, phone, name, passHash, salt, type, status, createdAt}]
- `pets`：[{id, name, province, city, district, category, breed, age, gender, vaccine, price, contact, desc, screenshots, mainShot, sellerId, status, rejectReason, ...}]
  - status：`pending`(待审核) / `active`(已上架) / `rejected`(已拒绝) / `offline`(已下架)
- `categories`：分类名数组
- `favs:<userId>` / `apps:<userId>`：收藏 / 预约
- `sess:<token>`：登录会话（7 天过期）

## 部署
1. 仓库推到 GitHub（`magaowen/magaowen`），Cloudflare Pages 自动部署。
2. KV 命名空间绑定变量名 **`MY_KV`**（见 `wrangler.toml`）。
3. 首次访问自动播种管理员账号（admin / 123456）与默认分类。

## 说明
- 所有写操作走 Bearer Token；读操作（列表/详情/分类）公开。
- 旧 `softwares` 键数据首次访问自动迁移到 `pets`。
- 接口为纯 JSON，便于后续接入微信小程序。
