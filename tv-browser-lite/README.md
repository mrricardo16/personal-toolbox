# TV Browser Lite

**通用 Android TV 浏览器（Kotlin + 内嵌 Mozilla GeckoView）**

自带网址栏，使用电视系统输入法；可访问普通 HTTPS 网址和局域网 HTTP + IP:端口页面。GeckoView 引擎随 APK 一起打包，无须先安装 Firefox，也不使用 Android System WebView。

## 项目当前状态（2026-10-22）

- 已分阶段提交 M0 工程配置、M1 GeckoView、M2 导航/输入、M3 原生错误与基本 JS 对话框。
- 已添加 [GitHub Actions 构建工作流](https://github.com/mrricardo16/personal-toolbox/actions/workflows/tv-browser-lite-build.yml)，自动执行单测与 Debug APK 构建，并在成功时上传 APK artifact。
- **此前版本**已在 GitHub Actions 完成 Android Gradle 编译、JVM 单测、Debug APK 打包与上传；尚未在小米电视实机测试。
- 新增最近 50 条网址历史与强制刷新（绕过 GeckoView 常规缓存）。
- 本轮修复普通方向键遥控器交互：网页模式虚拟光标、确认键合成点击、边缘手势滚动；工具栏模式使用原生焦点导航，返回键可从网页回到网址栏。
- 移除主页按钮；启动时仍恢复上次访问网址。网页表单沿用 GeckoView 默认输入法集成，并记录脱敏的焦点/输入法诊断事件。
- **GitHub Actions 构建与 JVM 单元测试已通过**，Debug APK 已上传；普通遥控器下的合成点击、网页账号/密码输入法和焦点返回仍须在目标电视实测。
- 最低 Android 8.0（API 26）；待核实设备 ABI、内存和兼容性。

## 下载已通过 CI 的 APK

- 构建：[遥控器焦点修复 CI（成功）](https://github.com/mrricardo16/personal-toolbox/actions/runs/39732249852)
- Artifact：[tv-browser-lite-debug-apk（ZIP，内含 `app-debug.apk`）](https://github.com/mrricardo16/personal-toolbox/actions/runs/39732249852/artifacts/12406095633)
- APK SHA-256：`bc1e4d0bbbda2ea306a34afbadeb03859bbb021fe0b99cc07e36846dd268208d`
- Artifact ZIP SHA-256：`e96e637f3c57b703cf044eb58ed3897bd17077e4affbda2cea2aeeb1edbcb7b9`
- APK 下载记录需要 GitHub 登录且有权限访问此仓库；ZIP 解压后安装 APK，不要把 ZIP 直接安装到电视。

1. 打开 [遥控器焦点修复的 GitHub Actions Run](https://github.com/mrricardo16/personal-toolbox/actions/runs/39732249852)。
2. 进入绿色 PASS 的运行记录 → Artifacts → `tv-browser-lite-debug-apk` 下载 ZIP，解压得到 APK。
3. 拷贝到 U 盘，安装于 Android 8+ 电视，启动 **TV Browser Lite**。
4. 首次启动时网址栏获得焦点；按确认键打开电视输入法，输入 `192.168.12.195:8221` 或完整 `http://192.168.12.195:8221` 后确认前往。网页模式下方向键移动虚拟光标，返回键切回工具栏。
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
