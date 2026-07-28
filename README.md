# 软件分享站

零成本软件分享网站：自适应列表页 + 多平台下载详情页 + 图片画廊。
部署于 EdgeOne Pages（腾讯云），国内访问快、长期免费、可绑自定义域名。

## 目录结构

```
site/
├── index.html      # 软件列表页（手机单列 / 电脑满铺）
├── detail.html     # 软件详情页（多平台下载 + 图片画廊）
├── data.js         # 软件数据（在这里添加/修改软件）
├── edgeone.yml     # EdgeOne Pages 部署配置
├── images/         # 软件截图（放这里，data.js 填 ./images/...）
└── files/          # 安装包（放这里，data.js 填 ./files/...）
```

## 如何添加软件

打开 `data.js`，复制一个 `{...}` 对象改内容：

```js
{
  id: "wechat",                 // 唯一标识，不重复
  name: "微信",
  icon: "💬",
  desc: "简介",
  category: "社交",             // 用于列表分类
  version: "v8.0.0",
  size: "120 MB",
  updated: "2026-07-01",
  screenshots: ["./images/wechat/1.jpg"],   // 图片路径或外链
  downloads: {                  // 只填有的平台，页面自动显示
    pc: "https://...",          // Windows
    android: "https://...",     // 安卓
    ios: "https://...",         // iOS
    mac: "https://...",         // Mac
    linux: "https://..."        // Linux
  }
}
```

## 部署到 EdgeOne Pages

1. 注册腾讯云账号：https://cloud.tencent.com （需实名+手机）
2. 进入 EdgeOne Pages 控制台：https://console.cloudstudio.net/edgeone 或在腾讯云搜 "EdgeOne Pages"
3. 一键开通免费版（长期有效，不限流量）
4. 新建项目 → 导入 Git 仓库（GitHub / Gitee / CNB）
5. 框架预设选「其他 / 无」，构建命令留空，输出目录填 `.`
6. 部署完成，获得 `*.edgeone.app` 域名
7. 想绑自己的域名：控制台 → 自定义域名 → 按提示加 CNAME 解析

推代码到 Git 后，每次 push 自动重新部署。
