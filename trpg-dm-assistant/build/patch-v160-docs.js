"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.5.13","# TRPG AI 主持助手 v1.6.0");
text=text.replace("当前版本为 v1.5.13。","当前版本为 v1.6.0。");
const marker="## v1.5.13 更新内容";
const section=[
"## v1.6.0 更新内容",
"",
"- 新增 CoC Resolution Engine 1.0：在既有浏览器掷骰基础上加入 browser-owned Check Contract 与 Outcome Contract，把检定目标、难度、奖惩骰、骰点、成功等级和最终 passed 明确收回浏览器机械裁决层。",
"- AI 仍可请求检定并叙述结果，但角色技能/属性/Luck/SAN 目标值来自浏览器角色卡；Check Contract 建立后若 target、difficulty 等被篡改，会在掷骰前 fail-closed。",
"- 每次 CoC 浏览器骰都会生成 immutable Outcome Contract，区分 raw success rank 与是否满足本次难度，并向 AI 续写只暴露受控 narrativeBudget；禁止改骰点、改目标、翻转成功/失败或超出额外洞察预算。",
"- 覆盖 critical / extreme / hard / regular / failure / fumble / skipped，以及困难/极难要求不足时的失败语义；现有 CoC 96/100 大失败边界继续由浏览器规则决定。",
"- 旧 Schema 8 检定记录无需迁移，载入时可懒重建 Resolution/Outcome Contract；Save Schema 仍为 8，AI protocol 仍为 1.3。",
"- 诊断边界保持暗骰保密：默认 diagnostics 只包含公开 Outcome Contract，只有显式 includeSecrets=true 才包含暗骰；诊断读取不会推进 canonical revision。",
"- v1.6 真实 provider gate 还暴露了一个 transport 边界：Node 24 对 AbortController.abort(\"timeout\") 可能表现为 TypeError。现在按请求自身 AbortSignal.reason 精确区分 timeout 与 user cancel，timeout 进入 API Resilience，可取消操作仍不自动重试。",
"- 修复历史测试中把版本号仅按 patch component 比较的问题，使 v1.6.0 不会被旧 v1.5.5/v1.5.6 测试误判为更低版本；所有行为断言保持不变。",
"- 新增 43 条 v1.6.0 deterministic 回归，永久完整套件目标提升为 501 PASS / 0 FAIL；成功 real DeepSeek Run 31367411977 完成 8 actions / 8 structured requests / 9 API attempts / 1 retry / 0 technical leaks，并正常进入 ending-solved。",
"- 本版没有给正常成功回合增加额外 AI 请求，也没有扩大 AI canonical 权限。v1.6.0 是 Resolution Engine 第一阶段；结构化 failure-forward consequence、SAN 损失、伤害与战斗规则留在后续 v1.6.x。",
"",
""
].join("\n");
if(!text.includes("## v1.6.0 更新内容")){
  if(!text.includes(marker))throw new Error("README v1.5.13 marker missing");
  text=text.replace(marker,section+marker);
}
if(!text.startsWith("# TRPG AI 主持助手 v1.6.0"))throw new Error("README title patch failed");
if(!text.includes("当前版本为 v1.6.0。"))throw new Error("README current version patch failed");
if(!text.includes("501 PASS / 0 FAIL"))throw new Error("README deterministic total missing");
fs.writeFileSync(file,text,"utf8");
console.log("V160_DOCS_PATCH:PASS");
