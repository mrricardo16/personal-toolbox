# TV Browser Lite

**通用 Android TV 浏览器（Kotlin + 内嵌 Mozilla GeckoView）**

自带网址栏，使用电视系统输入法；可访问普通 HTTPS 网址和局域网 HTTP + IP:端口页面。GeckoView 引擎随 APK 一起打包，无须先安装 Firefox，也不使用 Android System WebView。

## 项目当前状态（2026-10-22）

- 已分阶段提交 M0 工程配置、M1 GeckoView、M2 导航/输入、M3 原生错误与基本 JS 对话框。
- 已添加 [GitHub Actions 构建工作流](https://github.com/mrricardo16/personal-toolbox/actions/workflows/tv-browser-lite-build.yml)，自动执行单测与 Debug APK 构建，并在成功时上传 APK artifact。
- **此前版本**已在 GitHub Actions 完成 Android Gradle 编译、JVM 单测、Debug APK 打包与上传；尚未在小米电视实机测试。
- 本轮新增最近 50 条网址历史、移除主页按钮、强制刷新（绕过 GeckoView 缓存）及网页表单输入法/焦点处理。
- 本轮 GitHub Actions 已通过 JVM 单元测试与 Debug APK 构建，APK 已上传为构建产物；电视上的账号/密码输入仍须实机验证。
- 最低 Android 8.0（API 26）；待核实设备 ABI、内存和兼容性。

## 下载已通过 CI 的 APK

- 构建：[最新 CI（成功，90 天工件）](https://github.com/mrricardo16/personal-toolbox/actions/runs/39397238551)
- Artifact：`tv-browser-lite-debug-apk`（ZIP，内含单文件 `app-debug.apk`）
- SHA-256：`83c012b546b2233c354735bb29a9bc3f5b6257d8bdec5c2f2a432a5fe4a73aad`
- APK 下载记录需要 GitHub 登录且有权限访问此仓库；ZIP 解压后安装 APK，不要把 ZIP 直接安装到电视。

1. 打开 [最新通过的 GitHub Actions Run](https://github.com/mrricardo16/personal-toolbox/actions/runs/39397238551)。
2. 进入绿色 PASS 的运行记录 → Artifacts → `tv-browser-lite-debug-apk` 下载 ZIP，解压得到 APK。
3. 拷贝到 U 盘，安装于 Android 8+ 电视，启动 **TV Browser Lite**。
4. 在地址栏输入 `192.168.12.195:8221` 或完整 `http://192.168.12.195:8221`，按输入法“前往”或屏幕按钮。
5. 点击“诊断”查看内核加载事件与错误码。浏览器无法证明 Vue 已 mount，需要对照网页自身调试证据。

## 开发命令

安装 Android SDK Platform 37、Build Tools 36.0.0、JDK 17 和 Gradle 9.3.1 后，在 `tv-browser-lite/` 目录运行：

```bash
gradle :app:testDebugUnitTest :app:assembleDebug
```

Gradle 将从 Mozilla Maven 获取 GeckoView 157 stable。源代码目录下有 `gradle/wrapper/gradle-wrapper.properties`，但**当前尚未包含 wrapper JAR**；可使用已安装的 Gradle 9.3.1 或由 Android Studio/Gradle 生成 wrapper。GitHub Actions 已配备 setup-gradle。

## 文档

- [方案设计](doc/solution-design.md)
- [开发实施](doc/development-guide.md)
- [测试验收](doc/test-and-acceptance.md)
- [诊断与安全](doc/security-and-diagnostics.md)
- [阶段进度](doc/progress.md)

## 注意

这是独立的 Gradle Android 应用，与 personal-toolbox 中其他纯 HTML 工具互不影响。已生成的是 Debug APK，**仅证明在 CI 可编译**，不代表完成电视实机与业务兼容性验收。请勿将签名私钥上传仓库或在公开日志中记录 Cookie、Token。
