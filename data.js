// ===== 软件数据（静态兜底）=====
// 正常情况前台从云端 API(/api/softwares) 读取；
// 若 KV 未开通导致 API 不可用，则退回本文件。
// 字段说明：
//  - screenshots: 图片直链数组（建议用图床/网盘直链）
//  - downloads: 各平台下载地址，只填你有的平台，页面自动隐藏其余
window.SOFTWARES = [
  {
    id: "demo-player",
    name: "影音播放器 Demo",
    icon: "🎬",
    desc: "轻量级本地影音播放器。这是示例，请在后台改成你自己的软件。",
    category: "影音",
    version: "v3.2.0",
    size: "86 MB",
    updated: "2026-07-20",
    screenshots: [
      "https://picsum.photos/seed/app1/800/500",
      "https://picsum.photos/seed/app2/800/500"
    ],
    downloads: {
      pc: "https://example.com/dl/pc",
      android: "https://example.com/dl/android",
      mac: "https://example.com/dl/mac"
    }
  }
];
