# TV Browser Lite 阶段进度

更新：2026-10-22。**此文件记录代码提交事实，不替代编译及电视实测证据。**

| 阶段 | 已提交范围 | 状态 |
| --- | --- | --- |
| M0 | 构建工具链、GeckoView 157、Android minSdk 26 | **PASS（CI 已解析并构建）** |
| M1 | Manifest、电视入口、原生 UI、GeckoView 初始化与会话 | **编译 PASS / 运行待实测** |
| M2 | 地址栏、HTTP/HTTPS 规范化、前进/后退/刷新、URL 单测 | **CI 单测 PASS / 运行待实测** |
| M3 | 网络错误、渲染异常、JS 对话框、诊断与受控导航 | **编译 PASS / 功能待实测** |
| M4 | GitHub Actions Gradle 构建、单测、Debug APK 及下载工件 | **PASS（Run 39396492474）** |
| M5 | 小米电视实机安装、页面/表单/长期运行 | **BLOCKED：尚无设备信息与 ADB 连接** |

## 当前环境真实限制

- 当前执行环境有 JDK 21，但没有 Android SDK / Gradle / ADB，且容器无法解析外部 Maven/Google 依赖域名。
- 不把源码提交当作 Gradle 成功，也不把 CI 构建当作电视安装成功。
- Debug APK 的构建和下载由仓库 GitHub Actions 执行；只有对应 workflow 显示 PASS 后才有可用工件。
- APK 中 GeckoView 使用 `org.mozilla.geckoview:geckoview-omni:157.0.20261005135250`，新内核最低 Android 8.0。
- 目前通用 omni 会增大 APK；待获取设备 ABI 后可改为对应 ABI 工件。
- 第一版不支持所有文件上传/下载、选择列表、权限交互、音视频特性；需要真实浏览器体验时继续分阶段完善。

## M5 实机验收待办

1. 取得小米电视 Android 版本与 ABI。
2. 从 GitHub Actions 下载并安装 Debug APK。
3. 百度 HTTPS、公网站点导航、局域网 HTTP 的 RSS 8221 和其他 Vue 8888。
4. 记录每个网站是否加载/操作、出错诊断与复现步骤。
5. 判定 TV Bro 的持续 Loading 是否消失；若 RSS 自身 JS 竞态存在，单纯更新 Gecko 引擎不保证解决。

## 对应文档

- [方案](solution-design.md)
- [开发](development-guide.md)
- [测试](test-and-acceptance.md)
- [安全与诊断](security-and-diagnostics.md)

## CI 调试记录（新增）

- Run #2（39394787082）：**FAIL**，`android-actions/setup-android@v3` 的 `sdkmanager tools` 不再存在，失败发生在任何 Kotlin/GeckoView 编译之前。
- 修复：使用 GitHub 托管 Ubuntu 的预装 Android SDK，通过 `sdkmanager` 仅安装所需 API 35 / Build Tools 35，并保留 setup-gradle。
- 修复后的 CI 是否通过：**待下一次运行实际验证**。

## CI Run #3 故障（39395444187）

- Android SDK 和 Gradle 初始化已经通过。
- `:app:checkDebugAarMetadata` 报 11 项错误；GeckoView 157 与 AndroidX core 1.19 要求 `compileSdk >= 37`，AndroidX core 要求 AGP >= 9.1.0。
- 修复采用：AGP **9.1.1**、Gradle **9.3.1**、编译 SDK **37**、Build Tools **36.0.0**，使用 AGP 9 内建 Kotlin 编译支持（删除重复 Kotlin Android 插件与 `kotlinOptions`）。
- `minSdk 26` 和 `targetSdk 35` 不变；电视仍要求至少 Android 8.0。是否编译成功以 CI 后续结果为准。

## CI 首次完整成功（2026-10-20）

- Workflow：<https://github.com/mrricardo16/personal-toolbox/actions/runs/39396492474>
- 构建源提交：`c6a327dc81c62c08410317429fdb96933cdb16ca`
- `gradle :app:testDebugUnitTest :app:assembleDebug --no-daemon --stacktrace`：**BUILD SUCCESSFUL（1m 35s）**。
- 单元测试 Gradle 任务：`:app:testDebugUnitTest` **PASS**。
- APK：`app/build/outputs/apk/debug/app-debug.apk`；工件名 `tv-browser-lite-debug-apk`。
- GitHub Actions 工件 ID：`12252066560`，上传成功，ZIP 约 **254,038,034 字节**。
- APK SHA-256：`21b9580dcf48d2c21e62f80c0fbfee38727604d7601f434b0dd9a7c5be1ad47b`。
- 工具链：Gradle 9.3.1、AGP 9.1.1、内建 Kotlin 编译器 2.4.21、compileSdk 37、Android SDK 平台包 `android-37.0`、JDK 17。
- 该构建完成的是 **Debug APK**，可侧载试用；**小米电视安装、正常输入、RSS 4.1 渲染及两小时稳定性仍未验收**。
- 本次以前 CI 多次失败：已解决过时 SDK tools package、sdkmanager PATH、平台包命名、AAR 元数据和 Kotlin 标准库编译器版本问题；对应 Git 历史与 Actions 运行保留了失败证据。

## 最新通过构建（2026-10-20）

- CI Run：<https://github.com/mrricardo16/personal-toolbox/actions/runs/39397238551>，**SUCCESS**。
- Git 源提交：`76e3037d7baaa32981f32e0ba252086f68c27ff3`；此提交只改动文档与 CI 路径/保留配置，浏览器业务代码与上次成功版本相同。
- Android 测试：`:app:testDebugUnitTest` **PASS**；Debug APK：`:app:assembleDebug` **PASS**；本轮 Gradle **BUILD SUCCESSFUL in 42s**。
- SHA-256（**本轮 APK**）：`83c012b546b2233c354735bb29a9bc3f5b6257d8bdec5c2f2a432a5fe4a73aad`。
- Artifact：`tv-browser-lite-debug-apk`，ID `12251824673`；下载记录中 ZIP 大小约 254,038,033 字节，**预计到期 2027-01-18 08:58 UTC**。
- 注意：Gradle Debug APK 可因构建时间/环境产生不同哈希；安装后回归请记录自己下载的那一份校验值。
- 完整 CI 成功与电视实机验收是两种不同证据：**电视机型、Android 版本、ARM ABI、实际启动与 RSS 4.1 兼容性仍待确认**。


## 功能迭代：历史网址、网页表单输入与强制刷新（2026-10-22）

- 分支：`feat/tv-browser-history-form-input-force-refresh`。
- 已提交源码：最近 50 条 HTTP(S) URL 持久化、历史列表、移除主页按钮、独立强制刷新（`LOAD_FLAGS_BYPASS_CACHE`）、GeckoView 焦点/系统输入法联动。
- 新增 JVM 单测覆盖历史去重、排序、容量上限、协议过滤和 Query/Hash 保留。
- **验证状态：** GitHub Actions `39720121848` 于 2026-10-22 成功完成 `:app:testDebugUnitTest` 与 `:app:assembleDebug`；Debug APK 已上传。APK SHA-256：`75022293bf974767bfeae178ba21d9bc4ff46bb49944ffd89665661af16141ed`。构建产物：[tv-browser-lite-debug-apk](https://github.com/mrricardo16/personal-toolbox/actions/runs/39720121848/artifacts/12400134912)。电视实机测试尚未完成。`LOAD_FLAGS_BYPASS_CACHE` 不等同于清除 Service Worker Cache API 或登录状态。


## 阻断缺陷修复：普通遥控器、网页输入法与地址栏焦点（2026-10-22）

- 实现方向：网页模式/工具栏模式分离；普通遥控器方向键驱动虚拟光标，确认键生成触摸点击，光标边缘通过合成滑动手势滚动页面。
- 返回键行为：输入法可见时优先交给系统关闭输入法；网页模式且输入法隐藏时切换到工具栏并聚焦地址栏；工具栏模式下按返回键按网页历史/退出规则处理。
- 保留 GeckoView 默认 TextInputDelegate，避免自定义输入法桥接与引擎默认行为相互竞争；增加焦点/IME 可见状态的脱敏诊断记录。
- 移除主页按钮，保留上次访问地址恢复、历史列表和强制刷新。
- 新增 RemoteCursorMathTest 覆盖光标边界、边缘滚动请求和零尺寸视口。
- **验证状态：** 最新 GitHub Actions Run `39732519091` 成功；`:app:testDebugUnitTest` 与 `:app:assembleDebug` 均 PASS。APK Artifact：[tv-browser-lite-debug-apk](https://github.com/mrricardo16/personal-toolbox/actions/runs/39732519091/artifacts/12404819677)。APK SHA-256：`540b25269b23f7d82f825759cdbc59efcccb22958f37a7d06c382d1fe83bd1d0`。Artifact ZIP SHA-256：`d3f6600a7bbff69e3b4b33600b6fdbdadb7feaaeca6ee5ed3867d3895747c94e`。电视实机验证仍待完成，不能将 CI 通过视为输入法和遥控器交互已在目标设备修复。
