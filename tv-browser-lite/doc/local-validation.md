# 本地独立校验记录（2026-10-20）

## 范围

仅检验 JVM 纯 Kotlin 工具类 `UrlNormalizer`；不涉及 Android API、Gradle、GeckoView 初始化和网页渲染。

## 环境

- `kotlinc`：本地可用 Kotlin 编译器 1.9.0
- `java`：OpenJDK 21
- 直接从仓库文件所对应的源码生成独立 `.jar` 运行测试。
- 编译阶段与执行阶段均成功，**10/10 测试检查通过**。

## 实际执行通过

| 场景 | 结果 |
| --- | --- |
| `192.168.12.195:8221` 自动补 HTTP | PASS |
| 包含 `/#/login` 的 Vue hash 路由 | PASS |
| 显式 HTTP + Query + Fragment 保留 | PASS |
| 普通域名默认 HTTPS | PASS |
| localhost 默认 HTTP | PASS |
| `%20` 编码与 Query/Fragment 不被二次编码 | PASS |
| 空输入拒绝 | PASS |
| file:/// 协议拒绝 | PASS |
| 带用户名密码的 URL 拒绝 | PASS |
| 非法端口 99999 拒绝 | PASS |

## 验证边界

- 这里测试的是 **UrlNormalizer 单一纯 Kotlin 源文件**，不是 Android 单元测试任务 `testDebugUnitTest` 的执行结果。
- 其余 Kotlin 文件（Activity、GeckoView delegates 等）仍待 Android Gradle 编译证实。
- 不能据此声明 APK 已生成、已签名或已在电视安装。
