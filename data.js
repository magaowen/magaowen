// ===== 软件数据 =====
// 添加新软件：复制下面一个 {...} 对象，改内容即可
// 图片放 images/ 目录，填 "./images/软件id/1.jpg"
// 安装包放 files/ 目录，填 "./files/xxx.exe"
// 没提供的平台不用写，页面会自动隐藏该按钮

const softwares = [
  {
    id: "demo-player",
    name: "影音播放器 Demo",
    icon: "🎬",
    desc: "轻量级本地影音播放器，支持主流格式与字幕。这是一个示例，把下面的信息改成你自己的软件。",
    category: "影音",
    version: "v3.2.0",
    size: "86 MB",
    updated: "2026-07-20",
    screenshots: [
      "https://picsum.photos/seed/app1/800/500",
      "https://picsum.photos/seed/app2/800/500",
      "https://picsum.photos/seed/app3/800/500"
    ],
    downloads: {
      pc: "https://example.com/dl/pc",
      android: "https://example.com/dl/android",
      ios: "https://example.com/dl/ios",
      mac: "https://example.com/dl/mac",
      linux: "https://example.com/dl/linux"
    }
  },
  {
    id: "demo-tool",
    name: "效率工具 Demo",
    icon: "⚡",
    desc: "示例软件：下载链接填 downloads 里对应的平台字段。不填的平台按钮不显示。",
    category: "工具",
    version: "v1.8.4",
    size: "24 MB",
    updated: "2026-07-15",
    screenshots: [
      "https://picsum.photos/seed/tool1/800/500",
      "https://picsum.photos/seed/tool2/800/500"
    ],
    downloads: {
      pc: "https://example.com/dl/pc2",
      mac: "https://example.com/dl/mac2",
      linux: "https://example.com/dl/linux2"
    }
  }
];
