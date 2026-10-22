# TV Browser Lite｜产品方案与技术架构

- 版本：Design v0.1
- 状态：设计，未实现
- 目标：**一款可替代 TV Bro 的通用 Android TV 浏览器**
- 引擎：**仅使用 Mozilla GeckoView**；不开发 Android System WebView 试验版或备用引擎

## 1. 背景与问题定义

现有 Windows Nginx 部署入口示例：`http://192.168.12.195:8221/`。用户的手机可打开该地址；小米电视上的 TV Bro 可打开公网网站和其他部署的 Vue 页面，但目标页面会停留在静态 HTML 加载动画。

已有源码分析指出两个**尚未验证的风险**：`config.js` 动态加载与 ES module 入口并行、`window.RssConfig` 在模块初始化时被读取；以及目标页面的 Vite 构建与设备浏览器内核的兼容性。**不能因此断言 GeckoView 一定修复目标网站**。本项目的产品定位仍是通用浏览器，并提供必要诊断能力以便区分浏览器故障和网页故障。

## 2. 用户故事与范围

### P0｜必须具备

1. 安装单个 APK 后，直接在应用中打开浏览器，不要求设备另外安装 Firefox。
2. 顶部**常驻可编辑地址栏**；点选后使用电视原生输入法，确认或点击“前往”即可访问。
3. 支持 HTTP、HTTPS、IPv4、域名、端口、路径、查询参数、Hash 路由及站内跳转。
4. 页面由同一应用内的 GeckoView 渲染，启用 Gecko 支持的现代 JavaScript / DOM Storage / Cookie 等 Web 能力。
5. 支持后退、前进、普通刷新/停止加载和强制刷新；不提供单独的主页按钮。
6. 网页加载进度、标题和当前 URL 与真实导航状态同步。
7. 加载失败时显示可理解的错误状态、可重试；对页面内部错误保留诊断线索。
8. 支持常见表单输入、键盘唤起和基础页面滚动。
9. 横屏适配、Android TV 启动入口、无需触摸屏也可以执行基础操作。
10. 本地保存上次访问地址，并持久化最近 50 条 HTTP(S) 网址；可清除浏览数据。

### P1｜后续迭代

书签、下载管理、文件选择器、权限管理界面、网页全屏视频、局域网页面快速入口、简易诊断日志导出。需要有需求或实测后再排期。

### 明确不做（V1）

多标签/多窗口浏览、云同步、账号系统、广告拦截、扩展插件、定制输入法、复杂遥控器虚拟鼠标、WebView 引擎切换、开机自启、RSS 专属业务改造。

## 3. 产品交互与 UI

```text
┌───────────────────────────────────────────────────────────────────┐
│ ‹  ›  ⟳  强刷  历史  [http://192.168.12.195:8221/#/login      ] [前往] [诊断] │
├───────────────────────────────────────────────────────────────────┤
│ [顶部细进度条，仅加载期间显示]                                      │
│                                                                   │
│                      GeckoView 网页渲染区                         │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ 页面标题 / 当前状态 / 可选错误入口                                  │
└───────────────────────────────────────────────────────────────────┘
```

- 初次启动：显示带地址输入指引的原生首页，焦点在地址栏或“输入网址”按钮。
- 输入框：选中即可唤出系统输入法；输入法“前往/完成”与屏幕“前往”触发同一导航。
- “刷新/停止”：加载中为停止，加载完毕为普通刷新；“强刷”使用 GeckoView 的 BYPASS_CACHE 标志重新加载；“历史”显示最近 50 条网址。
- 系统返回：地址栏正在编辑则先退出编辑；否则优先回退网页历史，无法回退时按 Android 系统行为退出。
- 全屏：可选开关，默认保留地址栏以符合“随时输入网址”的产品目标。
- 遥控器：不开发特殊映射/虚拟鼠标；但原生控件至少支持方向键焦点和确定键，网站内部交互能否用遥控器操作取决于网页本身。

## 4. URL 规范化规则

| 输入 | 结果 |
| --- | --- |
| `192.168.12.195:8221` | `http://192.168.12.195:8221/` |
| `192.168.12.195:8221/#/login` | `http://192.168.12.195:8221/#/login` |
| `http://192.168.12.195:8221/a?x=1#b` | 完整保留 |
| `https://www.baidu.com` | 完整保留 |
| `www.example.com` | `https://www.example.com/` |
| 无协议的外网域名 | 默认 HTTPS |
| 空白输入 / 不合法 URL / 不支持协议 | 拒绝导航并显示说明 |

不得把 `host:port` 当成搜索内容，不得隐式升级用户**显式输入的 HTTP**，不得破坏端口、大小写敏感路径、Query/Hash。URL 解析使用可靠解析器，并明确处理 IPv6、IDN、空白、转义及 `intent:`、`javascript:`、`file:` 等高风险 scheme：V1 只把 HTTP/HTTPS 作为地址栏可主动导航的目标，其他协议按安全策略拒绝或明确询问。

## 5. 架构与数据流

```text
MainActivity (Kotlin 原生 UI)
  ├─ AddressBar / NavControls / Progress / ErrorPanel
  ├─ BrowserController (输入、导航、状态、错误映射)
  ├─ GeckoRuntimeHolder (进程级复用 GeckoRuntime)
  ├─ GeckoSessionManager (单会话 / 生命周期)
  │    └─ GeckoView (应用内部网页渲染)
  ├─ BrowserPrefs (上次地址 / 最近 50 条网址)
  └─ DiagnosticsRepository (脱敏、限量、本地)
          │
          └── HTTP(S) / WebSocket → 用户输入的网站/Nginx/API
```

- **引擎与宿主分离**：宿主只负责浏览器工具栏、错误 UI、保存设置；网页交由 GeckoView 解析。
- **进程级运行时**：GeckoRuntime 初始化一次；Activity 重建时妥善恢复/关闭 GeckoSession。
- **委托事件**：NavigationDelegate 更新 URL 与前进/后退状态；ProgressDelegate 更新开始/结束/进度；ContentDelegate 管理标题及崩溃等内容事件；PromptDelegate 负责网页 prompt/选择交互；PermissionDelegate 采取默认拒绝或逐项确认策略。
- **导航可信源**：地址栏输入是用户主动导航，页面自动跳转/新开窗口应按 GeckoView 回调与安全策略处理，禁止任意跳转导致的 APP 危险 intent 执行。
- **会话数据**：Cookie/Storage 遵循引擎正常行为；项目设置不保存用户密码。清除浏览数据需明确区分引擎站点数据与宿主保存的主页。
- **错误可见性**：加载开始与结束不等于 Vue 已经成功 `mount`；只展示可实际观测到的状态，不能将网页 JS 初始化失败冒充网络错误。

## 6. 兼容性与包体

- 新版 GeckoView 以 **Android 8.0 / API 26+** 为主要目标；构建时以所选稳定发行工件的官方要求为准。
- 先读取设备 `ro.build.version.sdk` 与 `ro.product.cpu.abilist`，再选定 CPU ABI（通常 `armeabi-v7a`、`arm64-v8a`）。
- 交付可直接侧载的**单文件 APK**；可以按 ABI 分包，但每个 APK 都应能独立安装，不交付依赖额外安装器的 split 集合。
- 自带 GeckoView 比系统 WebView 壳的安装包大；电视内存和 GPU 兼容性需要实机验证。
- 自定义 HTTP 用户输入需要合法的 Android 明文网络配置；对公网优先 HTTPS。不能通过禁用 TLS 校验“解决兼容性”。
- 本项目与 `personal-toolbox` 中单文件 HTML 工具的构建方式不同，是一个独立 Gradle 子项目。

## 7. 安全边界

- 仅申请必要的 Android INTERNET 等权限；不默认放行摄像头、麦克风、定位等网页权限。
- HTTPS 证书无效时不可静默继续；不能启用任意不可信 JavaScript↔Native Bridge。
- 地址栏严格限制/确认外部协议；不允许网页隐式打开本机任意文件或任意 Android intent。
- 诊断仅记录时间、类型、脱敏 URL/路径与错误状态；不得记录 Cookie、认证头、Token、密码、查询参数内的密钥。
- 不承诺浏览器能绕过 CORS、服务端认证、企业内部网络 ACL 或前端自身运行时错误。
- 引擎是第三方依赖，需要制定更新和 CVE 跟踪规则。

## 8. 决策、风险与待确认项

**已决定**：Kotlin；Android 原生 UI；唯一浏览器引擎 GeckoView；单会话、单窗口；可输入任意 HTTP/HTTPS；可侧载 APK；只改本目录。

**待确认**：电视 Android SDK/ABI/可用内存、是否支持 ADB；最终 GeckoView stable 和 Android Gradle Plugin 组合；实际首页偏好；安装来源策略；是否需要文件上传控件/扫码输入。

**风险**：
1. 设备 Android 太旧，不满足新版 GeckoView 最低版本；
2. ABI/GPU/内存或系统安装策略不匹配；
3. RSS 的 `config.js` / module 竞态仍然存在；
4. 部分电视键盘与 GeckoView 焦点行为不一致；
5. HTTP API/WebSocket 与目标网页的自身安全策略仍会限制功能。

## 9. 第一版完成定义

通过文档《test-and-acceptance.md》的 P0 用例；可正常安装、输入 HTTP 局域网地址和 HTTPS 公网地址、打开页面、输入表单、回退与刷新；失败可看见错误且不会无限空转。**RSS 4.1 是否正常运行是重要对照用例，不代表浏览器核心功能的唯一评价标准**。

## 10. 参考

- Mozilla GeckoView Quick Start：https://mozilla.github.io/geckoview/consumer/docs/geckoview-quick-start
- Mozilla GeckoView API：https://mozilla.github.io/geckoview/javadoc/mozilla-central/
- Mozilla 系统要求：https://wiki.mozilla.org/Mobile/GeckoView
