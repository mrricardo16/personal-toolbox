# TV Browser Lite｜开发实施文档

- 版本：Dev Guide v0.1
- 状态：**基本浏览器源码已实现，已在 GitHub Actions 编译通过；实机仍待验收**
- 约束：仅 GeckoView，引擎随 APK 打包；不引入 System WebView、Chrome Custom Tabs、外部 Firefox 启动或 RSS 专属页面代码。

## 1. 开发环境与先决条件

1. Windows 上安装 Android Studio、与所用 AGP 匹配的 Android SDK/Build Tools、JDK 17、ADB；可安装 Gradle 9.3.1 直接构建；wrapper.properties 已存在，但仓库尚未提交 wrapper JAR。
2. 先查明目标电视 Android 版本、CPU ABI、存储与可用内存：
   ```powershell
   adb devices
   adb shell getprop ro.build.version.sdk
   adb shell getprop ro.product.cpu.abilist
   adb shell getprop ro.product.model
   ```
   若未开启 ADB，可先在电视“关于/系统信息”查看；不能据“TV Bro 能安装”直接推断 ABI 或系统最低版本。
3. 官方文档确认本次锁定的 **GeckoView stable** artifact、Maven 仓库、Android 最低 SDK、ABI 支持以及与 AGP 的兼容性；将实际验证的版本写入版本清单。**不得使用动态版本 `+` 发布**。
4. Android 8.0 / API 26+ 作为新版引擎的初始门槛，若电视低于门槛应暂停开发/明确转为旧版兼容专项，而不是偷偷回退到系统 WebView。
5. 此仓库原本多为独立 HTML 工具；项目只能在 `tv-browser-lite/` 下创建 Gradle 工程，不修改仓库其他项目或其 CI。

## 2. 目标工程结构（当前基本结构已建立）

```text
tv-browser-lite/
├── README.md
├── doc/
│   ├── solution-design.md
│   ├── development-guide.md
│   └── test-and-acceptance.md
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
├── gradle/wrapper/
├── gradlew
├── gradlew.bat
└── app/
    ├── build.gradle.kts
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/.../tvbrowserlite/
        │   ├── MainActivity.kt
        │   ├── browser/BrowserController.kt
        │   ├── browser/GeckoRuntimeHolder.kt
        │   ├── browser/GeckoSessionManager.kt
        │   ├── browser/UrlNormalizer.kt
        │   ├── settings/BrowserSettingsRepository.kt
        │   └── diagnostics/DiagnosticsRepository.kt
        └── res/
            ├── layout/activity_main.xml
            ├── drawable/
            └── values/
```

上述目录**是开发目标，不代表已经建立源码**。

## 3. 构建依赖约束

- 只引用官方发布的 `org.mozilla.geckoview` **stable** 工件及其 Maven 仓库；具体版本和坐标从 Mozilla 官方 Quick Start 获取并固定。
- 开发语言 Kotlin；Java/Android Gradle 工具版本按官方兼容矩阵组合，落地前写在 README。
- 保留 Gradle Wrapper，开发机器与 CI 使用相同 wrapper；Debug 与 Release 用独立签名策略。
- 打包根据 `abiFilters` 或独立 flavor/split 生成与电视对应的独立 APK，注意不要把拆分产物误当成可单独安装的 universal APK。
- 先编译 Debug，再构建签名 Release；明确区分 `assembleDebug` 与 `assembleRelease` 的产物，生成 SHA-256 校验和。
- 单个 APK 是交付约束；APK 文件及密钥/证书不要无条件提交到 Git 历史。Release 私钥不能上传 GitHub。

官方接入文档：https://mozilla.github.io/geckoview/consumer/docs/geckoview-quick-start

## 4. Android Manifest 与系统行为

至少考虑：

- `android.permission.INTERNET`。
- Android TV `LEANBACK_LAUNCHER`；应用名、图标与 banner；不依赖触摸屏（`android.hardware.touchscreen` required=false）。
- 横屏、输入法 `windowSoftInputMode="adjustResize"`（实际根据 GeckoView 当前版本校验）。
- 用户主动访问 HTTP 需要允许明文 HTTP；本产品是通用浏览器，需在文档注明明文风险，不得关闭 TLS 证书验证。
- 不引入与需求无关的危险权限；文件选择、外部 APP 打开、下载管理如果 V1 未做，需要告知用户。

## 5. GeckoView 宿主生命周期

建议落地顺序：

1. MainActivity 创建原生地址栏与按钮，以及 `GeckoView` 视图。
2. 通过 Holder 在单进程内只创建一次 `GeckoRuntime`，避免 Activity 重建重复初始化。
3. 创建 `GeckoSession`，设置必要 delegates，`open(runtime)` 后绑定 `geckoView.setSession(session)`。
4. 从原生地址栏取用户输入，经过 `UrlNormalizer`，调用当前 GeckoSession 导航 API（例如 `loadUri`）。
5. NavigationDelegate 处理位置变化、导航许可及是否可回退/前进；ProgressDelegate 处理开始、停止、进度和安全状态；ContentDelegate 处理标题等。
6. PromptDelegate 处理网页表单交互（alert、confirm、prompt、select 等按对应 API）；权限请求默认拒绝或通过用户确认，不得自动全开。
7. 正确处理 Activity 暂停/恢复/销毁、输入焦点、旋转或系统回收；不得复用已经关闭的 Session。
8. 监听页面崩溃、加载失败和导航拒绝，转换为原生错误页/诊断信息。

注意：GeckoView 的委托具体方法签名可能随版本变化，**以锁定的稳定版 JavaDoc 实现和编译校验**，不要从过时示例机械复制。

## 6. 用户操作合同

### 地址栏输入

- 点击地址栏 → 系统输入法 → 确认/前往 → URL 规范化 → GeckoSession 导航。
- 地址栏支持全选编辑、光标定位、粘贴，不自动按关键词搜索。
- 输入 `192.168.12.195:8221`、`http://192.168.12.195:8221/` 都应访问相同 HTTP 站点。
- 输入 `www.baidu.com` 默认 HTTPS；显式 HTTP 不更改。
- 不支持的 scheme、空 URL、非法 host/port 显示错误，不允许静默抛异常。

### 导航与加载

- 返回/前进按钮状态以当前 Session 的实际历史能力为准，不用自己硬编码栈。
- 页面正在加载时普通刷新按钮切换为“停止”，加载完成后恢复为普通“刷新”；“强刷”使用 `GeckoSession.LOAD_FLAGS_BYPASS_CACHE` 重新加载。
- 浏览器地址栏必须随内部点击、Hash 路由、重定向更新。
- 首屏加载失败时显示原生错误，不得只转圈；超时状态可提示用户检查连接，需允许重试。
- 本地保存上次网址，并记录最近 50 条 HTTP(S) 地址；从“历史”列表选择后直接导航。工具栏不提供主页按钮。保留 Cookie/Storage 的默认站点隔离策略。

### 输入法与电视

- 仅使用系统输入法，不做自定义软键盘。
- 允许 Android TV 焦点通过方向键触达地址栏、前往、导航按钮；网页表单输入通过 `GeckoSession.TextInputDelegate` 与系统输入法联动，用户名/密码框仍须在目标电视实测。
- 不承诺未针对键盘设计的 Vue 页面可被遥控器完整操控，必要时用鼠标作为辅助。

## 7. 浏览器与网页错误分层

| 层次 | 可观测现象 | App 行为 |
| --- | --- | --- |
| 系统/引擎初始化 | GeckoRuntime/Session 无法创建 | 原生错误界面及最小诊断，不崩溃循环 |
| 网络 | DNS、连接拒绝、超时、TLS 错误 | 记录脱敏错误类型，显示重试 |
| 主文档 | HTTP 错误或加载失败 | 保留目标 URL 和可见状态 |
| 脚本/应用 | HTML 已到达但 Vue 未 mount | 不虚报网络故障；提供加载状态/必要时远程调试 |
| API / WebSocket | 页面内部接口异常 | 不假设 App 能从普通页面加载回调识别全部问题 |

**GeckoSession 的 onPageStop / 加载进度不等于 Vue mount 成功。** 如需精准诊断 Vue 生命周期，应当在被测网页增加诊断钩子，或使用 Gecko 专用调试手段。不得把网页所有请求视为可随意截获的 API。

## 8. 安全实施清单

- HTTP 明文是用户显式允许的浏览能力；地址栏区分安全/不安全连接，不建议明文传输敏感数据。
- 严禁跳过证书校验、全局无条件信任 HTTPS。
- 外部 intent / `file:` / `content:` / `javascript:` 采用受控策略。
- 默认禁止未明确授权的定位、相机、麦克风、通知权限；Cookie/Storage 遵循 GeckoView 的网站隔离。
- 调试日志脱敏，不采集密码、认证标头、Cookie/Token、敏感查询参数。
- 页面崩溃恢复不能无限重启、无限重试；设定退避或手动重试。
- 不向网页注入危险的 Native JS Bridge。

## 9. 交付里程碑

| 阶段 | 工作 | 交付证据 |
| --- | --- | --- |
| M0 环境确认 | 设备 SDK/ABI、官方稳定依赖与 Gradle 版本锁定 | 环境记录和依赖清单 |
| M1 浏览闭环 | 原生 UI + GeckoRuntime/Session + URL 导航 | Debug APK、界面截图、测试记录 |
| M2 导航/输入 | 回退/前进/刷新/输入法、标题、进度 | P0 功能用例结果 |
| M3 错误/安全 | 页面失败可见、权限策略、脱敏诊断 | 故障用例结果 |
| M4 打包验收 | 按 ABI 单文件 APK、签名、实机回归 | 安装记录、SHA256、已知问题 |

## 10. Codex 开发执行原则

1. 先只读检查 `tv-browser-lite/` 的文档和已有目录，不修改其他工具。
2. 在动手前查实电视设备信息及当前官方稳定 GeckoView artifact；未知信息明确标记待验证。
3. 直接实现 **GeckoView**，不创建 System WebView 试验版。
4. 每个里程碑执行 Gradle 构建与可执行测试；编译失败必须定位修复。
5. 如无电视/ADB 连接，明确“未进行实机测试”，不能宣称安装或网站访问成功。
6. 文档、代码和 APK 版本应一致；新增功能同时补充测试用例与变更记录。
7. 禁止改写 `personal-toolbox` 其他工具代码、README 历史内容和仓库级工作流，除非后续明确授权。

## 11. 已锁定并经过 CI 验证的版本

- Gradle 9.3.1；AGP 9.1.1；JDK 17。
- Kotlin Gradle plugin 2.4.21：仅保留于根项目 `apply false`，由 AGP 9 的 built-in Kotlin 集成，不在 app module 重复 apply。
- Android `compileSdk=37`（SDK 安装标识 `platforms;android-37.0`），`targetSdk=35`，`minSdk=26`。
- GeckoView `geckoview-omni:157.0.20261005135250`。
- CI 首次 SUCCESS：https://github.com/mrricardo16/personal-toolbox/actions/runs/39396492474；SHA-256 见 progress.md。
- 这一结果只验证编译/单元测试，不意味着电视已安装或 RSS 业务页面通过。
