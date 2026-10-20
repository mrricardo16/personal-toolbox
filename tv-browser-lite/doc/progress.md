# TV Browser Lite 阶段进度

更新：2026-10-20。**此文件记录代码提交事实，不替代编译及电视实测证据。**

| 阶段 | 已提交范围 | 状态 |
| --- | --- | --- |
| M0 | Gradle/AGP/Kotlin 配置、固定 GeckoView 版本、最小 Android SDK 26 | 已提交；依赖未在本地解析 |
| M1 | Manifest、电视入口、原生 UI、GeckoView 初始化与会话 | 已提交；未编译 |
| M2 | 地址栏、HTTP/HTTPS 正规化、前进/后退/刷新/主页、基础 URL 单测 | 已提交；UrlNormalizer 的独立 JVM 10 项检查 PASS，Android 单测待 CI |
| M3 | 网络错误类别与代码、内容进程异常提示、JS alert/confirm/prompt、受控导航与诊断 | 已提交；未编译 |
| M4 | GitHub Actions 独立 Gradle 构建及 APK 工件 | 已提交工作流；是否通过请查看 Actions |
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
