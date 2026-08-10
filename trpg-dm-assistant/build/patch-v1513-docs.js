"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.5.12","# TRPG AI 主持助手 v1.5.13");
text=text.replace("当前版本为 v1.5.12。","当前版本为 v1.5.13。");
const marker="## v1.5.12 更新内容";
const section=[
"## v1.5.13 更新内容",
"",
"- 新增 Full Case E2E：用一条完整调查案件把 Player Assertion Guard、Interaction Availability、Clue Route、Progress Semantics、Authored Threat Clock、NPC Knowledge Boundary 和 Ending / Resolution Gate 串成同一运行时闭环，不再只依赖各模块孤立单测。",
"- 新增 37 条 v1.5.13 确定性长局回归，覆盖完成式多步玩家断言、无收益行动、三条正式线索、NPC 禁知/知识传播、两次真实节点切换、威胁推进/解决、提前结局恢复、最终结局确认、诊断与 Schema 8 归一。",
"- 永久确定性套件从 421 提升为 458 PASS / 0 FAIL；Save Schema 仍为 8，AI protocol 仍为 1.3。",
"- 新增当前产品运行时真实 API E2E：直接调用正式 `requestPlayerAction()`、API Response Resilience、协议校验、事务提交、浏览器明骰续写、节点/结局确认链，而不是旧版手写简化 JSON 模板。",
"- 永久 `TRPG DM Assistant Real API Acceptance` 已升级为运行 `test-real-api-v1513.js`，真实 provider 验收使用 `deepseek-v4-flash` 并保留运行时请求/重试/空响应统计。",
"- 真实长局发现 DeepSeek 会把合法 `addRevealedTruth` 的正式 `text` 字段输出为 `description`。v1.5.13 只对这个已知 operation 增加窄兼容：仅当 `text` 缺失且 `description` 为非空字符串时归一为 `text`；未知 operation、空参数与其它业务协议错误继续严格失败。",
"- 两次最终成功的真实运行都完成案件结局且无技术 ID 泄露：Run 31355661648 为 8 actions / 8 structured requests / 13 API attempts / 5 retries；Run 31355896683 为 8 actions / 1 browser check / 9 structured requests / 11 API attempts / 2 retries。两次均经历 provider empty 与一次 graceful retry exhaustion，但都没有 canonical corruption 或 interaction dead-end。",
"- 真实 E2E 明确关闭测试 VM 内与本目标无关的后台自动摘要，以避免测试脚本连续提交动作时人为制造摘要并发竞争；正式产品摘要逻辑没有被修改。",
"- 本版没有新增正常游戏 API 请求，也没有扩大 AI 的 canonical 状态权限；新增的是更完整的验证链与一个由真实 provider 证据驱动的窄字段别名。",
"",
""
].join("\n");
if(!text.includes("## v1.5.13 更新内容")){
  if(!text.includes(marker))throw new Error("README v1.5.12 marker missing");
  text=text.replace(marker,section+marker);
}
if(!text.startsWith("# TRPG AI 主持助手 v1.5.13"))throw new Error("README title patch failed");
if(!text.includes("当前版本为 v1.5.13。"))throw new Error("README current version patch failed");
if(!text.includes("458 PASS / 0 FAIL"))throw new Error("README v1.5.13 deterministic total missing");
fs.writeFileSync(file,text,"utf8");
console.log("V1513_DOCS_PATCH:PASS");
