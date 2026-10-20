# 开发进度与证据

## 状态准则

- DONE：对应文件已实际提交，并已验证远端存在。
- CODE：已实现源码但未编译通过。
- BLOCKED：前置条件不足。
- PASS：仅指有实际构建日志或设备测试结果支撑。
- 不把 GitHub 提交成功等同于编译/实机通过。

## 2026-10-20

| 阶段 | 工作内容 | 当前状态 | 核验 |
|---|---|---|---|
| M0 | 仓库目录、版本固定、Gradle 构建配置 | DONE（配置已提交） | 源码可查，依赖尚未解析 |
| M1 | GeckoView 容器、原生界面 | 待提交 | 尚未编译 |
| M2 | URL 输入、导航与输入法 | 待提交 | 尚未测试 |
| M3 | 错误提示、提示框、安全与诊断 | 待提交 | 尚未测试 |
| M4 | CI 构建与 APK 产物、实机验收 | 待执行 | 本地无 Android SDK/ADB；CI 构建待触发 |

## 技术决策

- 仅 GeckoView，不使用系统 WebView。
- GeckoView stable 固定版本：`157.0.20261005135250`（Mozilla Maven 的 `geckoview-omni`）。
- Android minSdk 26；Android 7 无法运行此版本。
- AGP 8.13.2、Gradle 8.13、Kotlin 2.2.20、JDK 17、compileSdk 35。
- 未确定电视机型/ABI，因此先用 omni 通用构建，后续按设备信息优化大小。
- 远程 CI 验证前，**不能声称配置兼容或已生成 APK**。
