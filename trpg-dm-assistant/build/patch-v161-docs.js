"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.6.0","# TRPG AI 主持助手 v1.6.1");
text=text.replace("当前版本为 v1.6.0。","当前版本为 v1.6.1。");
const marker="## v1.6.0 更新内容";
const section=[
"## v1.6.1 更新内容",
"",
"- 新增 Mechanical Consequence Contract 1.0：在 v1.6.0 已由浏览器决定骰点和成功等级的基础上，继续把‘检定后允许落地什么惩罚性机械后果’收回浏览器权威层。",
"- CoC 检定续写中，AI 不能凭一次失败自行扣除 HP/SAN/资源、删除或减少物品、调整张力、新增威胁、推进威胁时钟或降低调查进度；未经浏览器证据授权的惩罚性操作会在 canonical transaction 前被剥离。",
"- 防御继续遵守 BLOCK UNSAFE STATE, NOT PLAYER ACTION：非法机械代价被剥离时，同一响应中的安全旗标、NPC 变化和正常叙事仍可继续，不把玩家交互变成技术失败。",
"- public node-origin check 的 authored successStateChanges/failureStateChanges 由浏览器重新从剧本定义读取并精确注入；AI 不能仅靠复制 checkId 获得作者权限。",
"- secret node check 维持旧暗骰链：authored effect 已在暗骰结束时由浏览器应用，continuation 不会再次注入，避免双重结算。",
"- SAN 检定损失仍由浏览器在 AI 续写前直接结算；Consequence Contract 将其标为 alreadyApplied，并阻止 continuation 再次 adjustSan。",
"- failure-forward 的张力代价现在由浏览器从 authored clue route 计算并补齐，AI 试图放大代价会被替换为作者定义值；大失败继续保持至少 2 点张力的既有规则。",
"- 当前边界刻意只收紧惩罚性后果：正向 HP/资源/调查进度等旧兼容行为暂不在本阶段统一收权，完整 reward/damage/combat/SAN consequence taxonomy 留在后续 v1.6.x。",
"- 新增 34 条 v1.6.1 deterministic 回归；连同既有 501 条，正式 release gate 为 535 PASS / 0 FAIL，并通过 JavaScript syntax、deterministic double build 和 single-HTML verifier。",
"- 真实 DeepSeek Run 31452147354：8 actions / 8 structured requests / 13 API attempts / 5 automatic retries / 5 provider empty / 0 retry exhaustion / 0 graceful fallback / 0 technical leaks，最终正常 ending-solved。该样本未触发浏览器检定，所以 mechanical consequence 正确性以 34 条 deterministic 专项为证，不夸大 provider 覆盖。",
"- APP_VERSION 为 v1.6.1，Save Schema 仍为 8，AI protocol 仍为 1.3，正常成功回合不增加 API 请求；正式单 HTML 产物为 524690 bytes。",
"",
marker,
""
].join("\n");
if(!text.includes(marker))throw new Error("missing v1.6.0 README marker");
if(!text.includes("## v1.6.1 更新内容"))text=text.replace(marker,section);
if(!text.includes("# TRPG AI 主持助手 v1.6.1")||!text.includes("535 PASS / 0 FAIL"))throw new Error("v1.6.1 README patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V161_DOCS_PATCH:PASS");
