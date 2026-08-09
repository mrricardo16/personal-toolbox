"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.5.9","# TRPG AI 主持助手 v1.5.10");
text=text.replace("当前版本为 v1.5.9。","当前版本为 v1.5.10。");
const section=`## v1.5.10 更新内容

- 新增 Authored Threat Clock：剧本作者可以为威胁时钟声明浏览器执行的推进 / 解决条件，AI 不再直接拥有 authored clock 的最终状态权限。
- 固定支持 \`stall\`、\`semantic\`、\`flag\`、\`clue\`、\`node\`、\`tension\`、\`turn\` 七类确定性规则事件，并支持 once、cooldown 和单次推进预算。
- authored clock 的 AI \`advanceClock\` / \`resolveClock\` 越权提议会被本地剥离，但同一响应中的合法状态变化继续执行，遵循 \`BLOCK UNSAFE STATE, NOT PLAYER ACTION\`。
- post-commit 解析只允许立即 resolve、绝不借新状态额外 advance；实际 \`enterNode()\`、AI canonical commit 和暗骰结果可在同回合满足解决条件，避免时钟晚一回合才解除。
- authored 时钟推进 / 触发写入 v1.5.9 Progress Semantics 的 \`THREAT\`，解决写入 \`RESOLUTION\`；时钟自身产生的语义不会递归触发自身。
- 无 authored clock 的旧剧本保持原五轮停滞 fallback，legacy clock 仍允许既有 AI \`advanceClock\` / \`resolveClock\` 操作。
- “雾港夜航”新增首个正式 authored clock“午夜涨潮”，按调查停滞、外部 THREAT 证据和结局节点确定性运行。
- 修复旧 legacy \`advanceClock\` 分支引用未定义 \`reason\` 导致状态事务失败的问题，不改变其原有权限范围。
- authored 配置在剧本启用前静态校验重复 ID、非法规则、无效 semantic kind、缺失 node / clue 引用等，坏配置不会覆盖当前案件。
- Save Schema 保持 8、AI protocol 保持 1.3，不增加 AI 请求；新增 32 条 v1.5.10 确定性回归。

`;
if(!text.includes("## v1.5.10 更新内容")){
  const anchor="## v1.5.9 更新内容";
  if(!text.includes(anchor))throw new Error("v1.5.9 README section anchor missing");
  text=text.replace(anchor,section+anchor);
}
if(!text.includes("- v1.5.10：")){
  const anchor="- v1.5.9：";
  if(!text.includes(anchor))throw new Error("version record anchor missing");
  text=text.replace(anchor,"- v1.5.10：加入 browser-owned Authored Threat Clock，用剧本作者规则驱动威胁推进 / 解决，AI authored clock 越权操作本地剥离，并支持同回合 post-commit 即时解决。\n"+anchor);
}
text=text.replace("`src/`：v1.5.9 的模块化源码；按状态、检定、AI 协议、剧本、记忆、安全边界、API 韧性、Progress Semantics、存档、UI、场景库和样式拆分。","`src/`：v1.5.10 的模块化源码；按状态、检定、AI 协议、剧本、记忆、安全边界、API 韧性、Progress Semantics、Authored Threat Clock、存档、UI、场景库和样式拆分。");
if(!text.includes("`build/test-v1510-authored-threat-clock.js`")){
  const anchor="- `build/test-v151-investigation-stability.js`：验证无收益行动、NPC 连续性、回合影响分类和上下文治理。";
  if(text.includes(anchor))text=text.replace(anchor,anchor+"\n- `build/test-v1510-authored-threat-clock.js`：验证 authored clock 权限、规则、幂等、post-commit 即时解决、legacy 兼容和静态配置校验。");
}
text=text.replace("当前版本报告为 `reports/trpg-dm-assistant-v1.5.9-test-report.md`。","当前版本报告为 `reports/trpg-dm-assistant-v1.5.10-test-report.md`。");
if(!text.includes("# TRPG AI 主持助手 v1.5.10")||!text.includes("## v1.5.10 更新内容")||!text.includes("reports/trpg-dm-assistant-v1.5.10-test-report.md"))throw new Error("v1.5.10 README patch incomplete");
fs.writeFileSync(file,text,"utf8");
console.log("V1510_README_PATCH:PASS");