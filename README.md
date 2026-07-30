# 全国宠物交易（PetShare）

同城宠物交易平台：用户注册即平台会员（可买可卖），发布（卖宠/求购）经审核后上架，管理员全权管理。
前端静态站 + Cloudflare Pages Functions + KV（`MY_KV` 绑定）。

## 角色与权限
- **会员（注册用户）**：注册即平台用户，不分买家/卖家；登录后既可发布卖宠，也可发布求购，并收藏/预约。
- **管理员**：账号 `admin` / 密码 `123456`；审核、下架、删除、用户封禁/设为或取消管理员、分类管理、统计。
  - 后台「用户管理」可将任意普通会员「设为管理员」，也可「取消管理员」（不能取消自己）。

## 目录结构
```
site/
├── index.html        # 首页（在售 / 求购 双列表 + 城市/类目/品种筛选）
├── detail.html       # 详情（卖宠：收藏/预约；求购：我可以提供）
├── publish.html      # 发布中心（卖宠/求购切换 + 我的卖宠/我的求购）
├── mine.html         # 我的后台（资料/改密/我的卖宠/我的求购/收藏/预约）
├── auth.html         # 登录 / 注册（注册即平台会员，无角色选择）
├── admin.html        # 管理后台（审核流 + 用户管理 + 求购管理 + 统计 + 分类）
├── common.js         # 公共前端库（主题/鉴权/API/城市数据/全品类品种库/图片压缩）
├── data-areas.json   # 全国省/市/区县数据（34 省 2846 区县）
└── functions/        # Cloudflare Pages Functions（API）
    ├── _lib/         # util / auth / db 公共模块
    ├── _middleware.js# 全局 CORS
    └── api/
        ├── auth/     # register / login / me
        ├── pets/     # 列表/发布（type=sell|want）+ [id] 详情/编辑/删除 + approve/reject/unpublish
        ├── admin/    # stats / users
        ├── categories.js
        ├── favorites.js
        └── appointments.js
```

## 数据模型（KV）
- `users`：[{id, phone, name, passHash, salt, type("user"|"admin"), status, createdAt}]
- `pets`：[{id, type("sell"|"want"), name, province, city, district, category, breed, age, gender, vaccine, price, budget, contact, desc, screenshots, mainShot, sellerId, status, rejectReason, ...}]
  - status：`pending`(待审核) / `active`(已上架) / `rejected`(已拒绝) / `offline`(已下架)
- `categories`：类目名数组（猫咪/狗狗/小宠/鸟类/水族/爬宠/异宠，可在后台增删）
- `favs:<userId>` / `apps:<userId>`：收藏 / 预约
- `sess:<token>`：登录会话（7 天过期）

## 品种库
`common.js` 内置猫/狗/小宠/鸟/水族/爬宠/异宠全品类知名+小众品种，发布时随类目联动下拉建议，且始终允许自定义输入。

## 部署
1. 仓库推到 GitHub（`magaowen/magaowen`），Cloudflare Pages 自动部署。
2. KV 命名空间绑定变量名 **`MY_KV`**（见 `wrangler.toml`）。
3. 首次访问自动播种管理员账号（admin / 123456）与默认类目。

## 说明
- 所有写操作走 Bearer Token；读操作（列表/详情/分类）公开。
- 旧 `softwares` 键数据首次访问自动迁移到 `pets`。
- 接口为纯 JSON，便于后续接入微信小程序。
