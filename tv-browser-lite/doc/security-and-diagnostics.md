# 安全与诊断实现记录

## 已实现源码（需 CI 编译确认）

- 顶层非 HTTP/HTTPS 协议拒绝；允许空白首页 `about:blank`。
- GeckoView 的网络/加载错误映射为类别和代码，显示在原生状态栏。
- 内容进程崩溃/被系统杀死显示用户可见提示。
- 记录最近 30 条**不带原始 URL/Token** 的浏览事件；诊断按钮显示 Android API、ABI、所用 GeckoView 主版本。
- 处理 JavaScript alert、confirm、prompt 的原生 Android Dialog。
- 不实现绕过证书验证，不向网页开放 Native JS bridge，不自动授予摄像头/麦克风/定位权限。

## 尚未实现或尚未验证

- 有限网页的 select/file picker 等更复杂 Prompt 类型（需补齐才符合完整通用浏览器功能）。
- GeckoView 页面崩溃自动恢复；当前明确提示重新启动应用。
- 清理站点 Cookie/Storage 的设置 UI。
- JavaScript Console、Vue mount 的诊断需要后续远程调试或网页端配合。**不能从 onPageStop 成功推出 Vue 已挂载**。
- HTTP(S) 服务端 4xx/5xx 响应不一定触发 Gecko 的 onLoadError，需要检查实际页面。
- 本执行环境无 Android SDK/Gradle/ADB，未进行设备或编译验证。
