# TV Browser Lite

面向 Android 智能电视的**通用网页浏览器**，使用 Mozilla **GeckoView（Firefox Gecko 引擎）**直接嵌入 APK，不使用 Android System WebView，也不依赖额外安装 Firefox、Chrome 或 TV Bro。

> 当前状态：**文档设计阶段（尚无应用源码、APK 或实机验收）**。本次只初始化文档，不表示已经解决任何电视端网页问题。

## 产品目标

- 应用内自带可编辑网址栏，支持 `http://`、`https://`、IPv4/域名、端口、路径、查询参数与 Hash 路由。
- 使用电视自带输入法；支持网页内表单输入、链接跳转、返回、前进、刷新、停止加载。
- GeckoView 引擎随应用打包成**可独立安装的 APK**，不调用系统浏览器展示页面。
- 兼顾局域网 Nginx 部署的 Vue Web 应用与公网网站，但**不是 RSS 专用客户端**。
- 在网页加载失败时提供原生错误信息，避免永久加载而无提示。

## 文档

| 文件 | 内容 |
| --- | --- |
| [doc/solution-design.md](doc/solution-design.md) | 需求范围、技术决策、架构、交互、安全与兼容性边界 |
| [doc/development-guide.md](doc/development-guide.md) | 工程结构、GeckoView 接入、关键实现点、开发里程碑与交付规范 |
| [doc/test-and-acceptance.md](doc/test-and-acceptance.md) | 测试矩阵、用例、验收门槛、已知不确定性 |

## 计划目录（尚未创建源码）

```text
tv-browser-lite/
├── README.md
├── doc/
│   ├── solution-design.md
│   ├── development-guide.md
│   └── test-and-acceptance.md
└── app/                       # 后续开发创建，当前不存在
```

## 与本仓库的关系

`personal-toolbox` 当前主要存放免构建的 Web 小工具。本项目是**原生 Android 应用例外**：需要 Android SDK、Gradle、Kotlin 和 Mozilla GeckoView 依赖；构建产物为 APK，而不是单文件 HTML。独立目录组织，**不改造其他工具的构建或工作流**。

## 重要边界

- GeckoView 可规避老旧 **Android System WebView 引擎**的部分限制，但不保证任何网站都能运行；网页自身的 JavaScript / 配置竞态仍须单独修复。
- 新版 GeckoView 的官方最低系统要求为 Android 8.0（API 26）；设备 Android 版本、可用 ABI、内存和安装空间应在首次构建前确认。
- 设计中的地址 `http://192.168.12.195:8221/` **仅作测试示例**，不得写死为唯一主页或目标地址。
- 不忽略 HTTPS 证书错误，不保存密码/Token 到诊断日志，不声称未经执行的实机测试通过。

## 官方资料

- [Mozilla GeckoView Quick Start](https://mozilla.github.io/geckoview/consumer/docs/geckoview-quick-start)
- [GeckoView API 文档](https://mozilla.github.io/geckoview/javadoc/mozilla-central/)
- [GeckoView 项目](https://github.com/mozilla/geckoview)
