# TV Browser Lite

**通用 Android TV 浏览器（Kotlin + 内嵌 Mozilla GeckoView）**

自带网址栏，使用电视系统输入法；可访问普通 HTTPS 网址和局域网 HTTP + IP:端口页面。GeckoView 引擎随 APK 一起打包，无须先安装 Firefox，也不使用 Android System WebView。

## 项目当前状态（2026-10-20）

- 已分阶段提交 M0 工程配置、M1 GeckoView、M2 导航/输入、M3 原生错误与基本 JS 对话框。
- 已添加 [GitHub Actions 构建工作流](../../.github/workflows/tv-browser-lite-build.yml)，自动执行单测与 Debug APK 构建，并在成功时上传 APK artifact。
- **源码在当前会话环境中未编译验证；Android 电视安装和 RSS 4.1 页面运行状态尚未验证。**
- 最低 Android 8.0（API 26）；待核实设备 ABI、内存和兼容性。

## 使用方式（CI 成功后）

1. 打开 [Actions → TV Browser Lite - Android CI](../../actions/workflows/tv-browser-lite-build.yml)。
2. 进入绿色 PASS 的运行记录 → Artifacts → `tv-browser-lite-debug-apk` 下载 ZIP，解压得到 APK。
3. 拷贝到 U 盘，安装于 Android 8+ 电视，启动 **TV Browser Lite**。
4. 在地址栏输入 `192.168.12.195:8221` 或完整 `http://192.168.12.195:8221`，按输入法“前往”或屏幕按钮。
5. 点击“诊断”查看内核加载事件与错误码。浏览器无法证明 Vue 已 mount，需要对照网页自身调试证据。

## 开发命令

安装 Android SDK 35 + JDK 17 + Gradle 8.13 后，在 `tv-browser-lite/` 目录运行：

```bash
gradle :app:testDebugUnitTest :app:assembleDebug
```

Gradle 将从 Mozilla Maven 获取 GeckoView 157 stable。源代码目录下有 `gradle/wrapper/gradle-wrapper.properties`，但**当前尚未包含 wrapper JAR**；可使用已安装的 Gradle 8.13 或由 Android Studio/Gradle 生成 wrapper。GitHub Actions 已配备 setup-gradle。

## 文档

- [方案设计](doc/solution-design.md)
- [开发实施](doc/development-guide.md)
- [测试验收](doc/test-and-acceptance.md)
- [诊断与安全](doc/security-and-diagnostics.md)
- [阶段进度](doc/progress.md)

## 注意

这是独立的 Gradle Android 应用，与 personal-toolbox 中其他纯 HTML 工具互不影响。源码当前不构成“已生产可用 APK”承诺。请勿将签名私钥上传仓库或在公开日志中记录 Cookie、Token。
