# AI 文档助手（V2）

> 文档更新时间：2026-11-17。当前发行包版本：**0.3.0**；新版页面标识为 **V2.2**（功能迭代标签，与发行包版本号不同）。

**交付结论：可以作为个人/内部试用版交付；尚未完成真实模型与业务模板验收，不应宣称为正式生产版。**

本目录保留最初的单文件 `index.html`。新版使用 **Vue 3 + ASP.NET Core (.NET 10) + Open XML SDK**，经后端调用 DeepSeek；原有 `index.html` 没有被新版覆盖。完整的交付记录见 [当前状态](docs/STATUS.md)。

## 1. 最快使用：Windows 便携版

1. 打开 [已验证的 main 构建（2026-11-17）](https://github.com/mrricardo16/personal-toolbox/actions/workflows/ai-document-writer-ci.yml)。
2. 在 **Artifacts** 中下载 `ai-document-writer-win-x64`（GitHub 构建产物有保留期限，失效后需重新执行 Actions）。
3. 解压 GitHub 下载的外层归档，再解压里面的 `AI-Document-Writer-v0.3.0-win-x64.zip`。
4. 双击 `AiDocumentWriter.exe`。应用监听 `127.0.0.1` 的随机端口并尝试打开默认浏览器。
5. 使用后端 JSON 中的 Key、网页临时 Key，或在桌面模式下将 Key 保存到当前电脑，之后选择写作模式开始使用。

目标电脑不需要另装 .NET、Node.js、Python 或 Microsoft Word；仍需兼容的 Windows x64 系统、现代浏览器和访问模型 API 的网络。**这是本地 Web 服务 + 浏览器，而不是纯静态 HTML 网页。**

## 2. 功能说明

| 模块 | 已提供的能力 | 边界 |
| --- | --- | --- |
| 常规写作 | 沿用原版 13 类文档技能、可编辑 Prompt、事实约束、保护项、两阶段审校 | 模型生成内容仍需核实 |
| DOCX 材料 | 多文件上传；读取正文、表格及常见标题层级；逐份设置事实/风格/两者兼用 | 暂不支持 OCR 和图片事实提取 |
| 年度/多月总结 | 逐篇提取带原文证据的事项，跨月关联、去重、疑点/冲突确认，台账编辑后生成 | 真实模型归并准确率尚未业务验收 |
| 结果与 Word | 正文可编辑；导出 Markdown、TXT、DOCX；支持默认排版/自动推荐或手选 Word 模板 | 复杂图文混排、精确分页不保证还原 |
| 模型配置 | JSON Key、会话临时 Key、桌面本机持久化 Key；查看 Token 用量 | 服务器版无内置用户/密钥隔离系统 |

### 常规文档工作流

选择文档类型 → 输入事实和写作要求 → 可上传 DOCX 并标记用途 → 生成初稿 → 可选忠实审校 → 编辑结果 → 导出。

### 年度/多月总结工作流

上传月报/季报并指定月份 → 按篇提取原文证据 → 关联同一事项的跨月进展 → 处理冲突/检查统计口径 → 编辑台账 → 生成并审校 → 选择 Word 排版模板导出。

同一项目的设计、测试、验收可以合并为阶段进展；各月独立巡检次数只有在统计口径一致且未重复时才允许累计。**不能把完成进度百分比相加，也不能把仅参考风格的旧报告当作今年事实。**


## 3. V0.3.0：Skill 写作与连续修订

- **写作引擎切换**：经典 Prompt 是默认回归基线。可选的实验 Skill 按文种提供专业方法，结构、篇幅、语体与重点以用户本轮明确要求为准。事实、安全和保护项仍须遵守。
- **继续修改**：在当前正文输入修改意见，选择“全文”或“选中文本”；服务端将局部修改内容拼接进原稿，未选中部分原样保留。AI 只生成候选稿，点击“采纳”后才更新正文。
- **版本记录**：初稿、审校稿、AI 修订稿可以回溯并对照；页面内最多保留 20 个快照，允许导出 JSON。**刷新页面会丢失未导出的版本**。
- **同材料 A/B**：手动点击一次可依次调用经典 Prompt 和 Skill 两条路线，产生两个可比较的版本，**产生两次模型调用费用**。
- **年度总结**：先确认事实台账，再利用原文证据附近的上下文以及可编辑的文章提纲进行撰写。
- **自动审校**：默认关闭；需要时单独输出一个审校版本，不覆盖初稿。

Skill 文件由本项目独立编写，概念参考公开开源项目，不直接复制受限制授权的原始 Skill 内容。更多信息见 [Skill 说明](docs/WRITING_SKILLS.md) 与 [写作 A/B 评测规范](docs/WRITING_EVAL.md)。**目前尚无真实模型证据证明新版文风一定优于原版。**

## 4. 容量与模型调用限制

- 默认最多上传 **15 份 DOCX**；单份 **8 MB**；合计 **60 MB**。
- 年度分析单篇提取文本最多 **150,000 字符**，后台按段分片提取；单份文档最多提取 **120 项事实**。
- 单次归并的事实台账最多 **250 项**；单次模型请求的用户 Prompt 上限为 **100,000 字符**、系统 Prompt 上限为 **30,000 字符**。
- 上传总容量与模型上下文容量不是一回事：6–15 篇长文档可能需要多次请求，归并输入过长时仍需缩小范围；尚未提供无限长文档的自动分层汇总。
- 使用真实 DeepSeek API 会产生费用。前端展示预计分片请求次数及接口返回的 Token 用量，**不是精确费用报价**。

## 5. 本地构建及 Web 部署

开发电脑需 `.NET 10 SDK`、`Node.js 22` 与 npm。进入 `ai-document-writer` 后执行：

```powershell
.\scripts\build.bat
```

产出 `dist/AI-Document-Writer-v0.3.0-win-x64.zip`。Linux 自包含服务器包可使用：

```powershell
.\scripts\build.ps1 -Target linux-x64 -Mode Server
```

Linux 发行 ZIP 不是可直接静态托管的网页，需要运行内含的 ASP.NET Core 服务。正式公网部署必须通过 HTTPS、访问认证与速率限制保护付费模型接口，当前程序**没有内置多用户认证/配额管理**。详细步骤见 [部署文档](docs/DEPLOYMENT.md)。

## 6. API Key 和敏感信息

- 桌面版可使用 `config/appsettings.local.json` 中的 `AiProvider.ApiKey`；服务端可使用 `AIWRITER_AiProvider__ApiKey` 环境变量。
- 桌面网页保存的 Key 由后端使用 ASP.NET Core Data Protection 保护，存储于当前用户应用数据目录，同时保存 Data Protection 密钥环；**不能据此承诺对拥有本机账号访问权限的攻击者安全**，应限制相关目录访问权限。
- 服务器模式不允许网页持久化全局 Key；临时 Key 只用于当次请求，不应通过不可信网络传输。
- 切勿将真实 API Key 放入仓库、发行 ZIP、日志或测试资料。禁止上传无权传输至外部 AI 服务的涉密或内部材料。

## 7. 交付与验收状态

V0.3.0 已合并到 `main`，PR 阶段 Windows/Linux CI 构建、启动与自动测试均通过；实际发布应以 [Actions 最新成功运行](https://github.com/mrricardo16/personal-toolbox/actions/workflows/ai-document-writer-ci.yml) 为准，仍需真实模型业务质量验收。

已在无真实 Key 的模拟环境中验证 **6 篇 DOCX → 9 条事实 → 跨月归并 → 总结 → Word 导出** 的数据流；测试结果是固定模拟模型响应，**不能证明真实 DeepSeek 对任意月报的事实提取或去重正确**。

仍待：真实 API 写作效果、授权月报的归并准确性、Word/WPS 中实际模板的视觉验收，以及目标服务器的正式部署/认证。

相关文档：

- [STATUS.md：当前可交付状态与风险](docs/STATUS.md)
- [ROADMAP.md：分阶段完成情况与后续优先级](docs/ROADMAP.md)
- [DEPLOYMENT.md：打包、密钥配置和部署](docs/DEPLOYMENT.md)
- [ACCEPTANCE.md：自动验收与真实业务验收清单](docs/ACCEPTANCE.md)
- [CHANGELOG.md：变更摘要](docs/CHANGELOG.md)
- [WRITING_SKILLS.md：Skill 内置方式与授权说明](docs/WRITING_SKILLS.md)
- [WRITING_EVAL.md：20 组 A/B 试验规范](docs/WRITING_EVAL.md)

## 8. 原版入口

旧版 [`index.html`](index.html) 仍可直接用浏览器打开；新版发布包将其作为 `/legacy.html` 保留。旧版会在浏览器端直接访问模型 API，而新版通过后端转发。两者部署与密钥管理方式不同。
