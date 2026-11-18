# AI 文档助手缺陷修复记录

基准为 `7c0f2f5ce9152ed9a524c483987a793ff632ab47`。修改位于独立分支 `fix/ai-document-writer-quality-audit`。旧单文件 HTML 保持原版本。

- BUG-01 新增可复跑写作 A/B 脚本。两条路径使用与常规写作相同的系统规则和用户 Prompt，仅 Skill ID 有差异。每个样本使用独立标识，盲评分发时不要发出 `blind-key.json`。默认写作策略沿用基准。当前没有真实写作质量数据。
- BUG-02 台账事实保留原文引文起点。模型建议的分组保留确定性来源、按月份整理，并在项目名冲突时要求人工确认。当同一明确项目的独立记录均具有跨月、不同阶段的精确原文证据时，程序重组时间线。别名、同名异项目及弱证据场景仍需核验。
- BUG-03 只有原文明确为本月或当月数量、各来源已指定不同月份、指标名与单位一致且无关键冲突时，程序计算合计并返回来源成员 ID。累计快照、进度、混合口径及重复月份不自动相加。原文未采用受支持表达时，需要在工作台人工确认后采用明确口径。
- BUG-04 年度事实提取、归并携带写作范围，提纲、正文及审校使用同一组适用写作要求。常规审校继承发起写作时的要求和事实。台账及写作要求变化后旧提纲不能直接用于新工作流。
- BUG-05 写作要求、事实材料及风格样本分区。工作台显示未核实疑点，正文不再直接拼接模型疑点。初稿和审校增加对内部标记、较长原样指令和复制风格历史数值的检查。改写产生的错事实仍需人工核对。
- BUG-06 当前稿有变化时迟到的初稿、A/B 结果和审校稿不能覆盖当前正文。连续修订仍使用已采纳的当前稿件。候选历史使用请求当时的修改要求与范围，采用前检查稿件和事实上下文。后端保留选区外原文，拦截删除保护项、新增缺少来源的常见量化值及回显修改指令。保护词存在性和量值检查无法判断所有事实关系或状态是否保真。

## 验证命令

```powershell
node --test frontend/tests/*.test.mjs
dotnet test backend/AiDocumentWriter.Tests/AiDocumentWriter.Tests.csproj -c Release
node evaluation/run-writing-ab.mjs --case S01 --case E02 --repetitions 2
pwsh -NoProfile -File scripts/build.ps1 -Target win-x64 -Version 0.3.0-quality-audit
pwsh -NoProfile -File scripts/verify-package.ps1 -Target win-x64 -Version 0.3.0-quality-audit -SmokeTest
```

前端 16 项、后端 22 项回归通过。A/B 计划在所选一条可配对的样本上显示 4 次计划调用。用本机模拟 HTTP 接口另测 1 轮，确认两臂提示词相同、输出使用匿名样本且可通过单独的映射表还原。未使用真实模型。

Windows 自包含 ZIP 构建和复验通过。包内服务成功监听本机随机端口，健康、Skill、浏览器来源隔离检查及 DOCX 导出通过。包名为 `AI-Document-Writer-v0.3.0-quality-audit-win-x64.zip`，大小 48,242,179 字节，SHA-256 为 `69F4A9B555279BA26BDE562BEAD71EA87A93A4DEFBB999A9BFEE715CF78F1877`。

首次启动测试发现原冒烟脚本会在默认本机应用数据目录保存再删除占位 Key。该目录在本次最早后端测试期间创建，未见影响既有保存 Key 的证据。已将冒烟测试的 Key 和密钥环隔离至包检查目录，复验后默认目录未再改变。

真实写作输出、真实模型归并准确性和 Word/WPS 实际版式仍待授权人工验收。
