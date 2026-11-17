# AI 文档助手｜变更记录

## 0.2.0 — 2026-11-17

> 当前发行包版本；页面展示 V2.1 为功能迭代标签。

### 新增与迁移

- Vue3 + ASP.NET Core Web API + Open XML SDK 新工程，保留原版单文件入口。
- 13 类文种规则复用，事实约束、保护项及双阶段审校。
- 多 DOCX 上传、来源用途管理、年度/月度事项提取与跨月归并。
- 关键冲突人工确认、来源证据核对、结构化台账编辑。
- Word DOCX 模板导出与 Markdown/TXT 下载。
- 后端 JSON / 页面临时 / 本机持久化 API Key。
- Windows 和 Linux 自包含 ZIP 与 GitHub Actions 构建。

### 稳定性与验证

- 单篇至多 150,000 字符的年度材料按段分片提取。
- 同一事项的分片证据去重与 Token 用量汇总。
- 桌面服务 Host/Origin 校验与请求访问约束。
- 6 篇合成 DOCX → 9 条事实 → 事项归并 → 总结 → Word 的 HTTP 自动化验收。
- Windows/Linux 发布包启动检查、Word 模板旧正文隔离检查。

### 已知限制

- 实际 DeepSeek 内容正确性与调用成本尚未使用真实业务样本验收。
- Word/WPS 模板视觉一致性尚未实机验收。
- 不支持公网匿名多用户运营、PDF/OCR 和复杂 Word 像素级还原。

## V1（原版单文件）

- 独立浏览器 HTML，直接调用模型 API；支持正式材料写作、13 种技能、自动审校、Markdown/TXT 下载。
- 源码入口保留在 `../index.html`，新版 ZIP 中为 `/legacy.html`。

更多信息：[当前状态](STATUS.md) · [路线](ROADMAP.md) · [验收](ACCEPTANCE.md)。
