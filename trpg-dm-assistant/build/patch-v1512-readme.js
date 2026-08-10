"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.5.11","# TRPG AI 主持助手 v1.5.12");
text=text.replace("当前版本为 v1.5.11。","当前版本为 v1.5.12。");
const marker="## v1.5.11 更新内容";
const section=[
"## v1.5.12 更新内容",
"",
"- 新增 Ending / Resolution Gate：AI 可以提出结局，但正式收束只由浏览器根据当前 canonical state 决定，AI 叙事本身没有结束案件的权限。",
"- 兼容并统一执行既有 `alwaysAvailable / requiredFlags / forbiddenFlags / minClues / requiresAnyClueIds / outcomeRequirements`，新增 `requiredClueIds`、`requiredResolvedLeadIds`、`requiredResolvedQuestionIds`、`requiredNodeIds`、`requiredClockStates`、`requireNoActiveThreats` 与 `requiredSemanticKinds`。",
"- 已知但条件未满足的 `endingProposal` 不再让整个状态事务失败：页面只剥离非法结局提议并局部中和明确的提前终局叙事，同一响应中已经通过校验的线索、旗标、NPC、物品等合法变化继续提交。",
"- 玩家确认 AI 提议的结局时会重新读取当前剧本结局定义并二次校验 canonical gate，防止 proposal 到确认之间的状态漂移；条件已变化时清除待确认结局并回到可交互状态。",
"- `applyEnding()` 统一经过同一浏览器 gate，避免内部调用或 UI 路径绕过结局条件；合法提交仍由 v1.5.9 Progress Semantics 记录 `RESOLUTION`。",
"- `alwaysAvailable` 的主动撤离/中止调查保持可用，不会因为新增门禁而被锁死。",
"- authored ending 的不存在 node / clock 引用、非法 Progress Semantic 和非法 clock state 在 Case Integrity 阶段作为 blocking ERROR；可能来自运行时动态内容的 clue / lead / question 仍按 WARN/INFO 处理，不把无法静态证明等同于错误。",
"- 请求上下文新增 `endingResolutionGate`，明确每个结局的 `ready` 状态和 `browser_canonical_resolution` 权威；提示只允许 AI 对 `ready=true` 的 endingId 发起 proposal，同时明确 gate 未满足时必须继续正常互动。",
"- 未知 endingId、未知 operation、检定前抢跑结局等真正协议错误继续严格失败；本版不把所有结局错误都安全吞掉。",
"- Save Schema 保持 8、AI protocol 保持 1.3，不增加 API 请求；新增 46 条 v1.5.12 确定性回归，永久完整套件目标为 421 PASS / 0 FAIL。",
"",
""
].join("\n");
if(!text.includes("## v1.5.12 更新内容")){
  if(!text.includes(marker))throw new Error("README v1.5.11 marker missing");
  text=text.replace(marker,section+marker);
}
if(!text.startsWith("# TRPG AI 主持助手 v1.5.12"))throw new Error("README title patch failed");
if(!text.includes("当前版本为 v1.5.12。"))throw new Error("README current version patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V1512_README_PATCH:PASS");
