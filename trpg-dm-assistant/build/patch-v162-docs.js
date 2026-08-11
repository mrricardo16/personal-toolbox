"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.6.1","# TRPG AI 主持助手 v1.6.2");
text=text.replace("当前版本为 v1.6.1。","当前版本为 v1.6.2。");
const marker="## v1.6.1 更新内容";
const section=[
"## v1.6.2 更新内容",
"",
"- 新增 Failure-Forward Cost Engine 1.0：失败前进的机械代价改为‘剧本作者声明、浏览器执行’，AI 只可选择/叙述合法 route，不能增减、替换或另造代价。",
"- `failure_forward` route.cost 现支持 tension / hp / san / progress / resources；未声明 tension 时保持旧兼容默认 1，显式 tension:0 可用于纯非张力代价，但全零成本会被 Case Integrity 阻断。",
"- 浏览器会去重同一 clue+route、先聚合作者成本，再按当前 canonical HP/SAN/调查进度/资源库存/张力空间截断；failure-forward HP 成本保持非致死，最低保留 1 HP。",
"- 大失败只在 authored tension > 0 时保持至少 2 点张力；显式 tension:0 不会因为 fumble 被强行改回张力成本。",
"- v1.6.2 完整接管旧 failure-forward 张力结算：既有 validateClueAcquisition 仍负责证明 route 合法，但旧 tension side effect 被中和，完整成本包只由 Cost Engine 结算一次，避免双扣并允许 tension:0。",
"- 既有 revealClue 调查进度奖励继续保留；例如初始 progress 7、失败线索 +3、作者 progress cost -4，实际净值为 6，而不是删除旧奖励。",
"- v1.6.1 Mechanical Consequence Contract 继续先剥离 AI 自报的 HP/SAN/resource/tension 等惩罚，再由 v1.6.2 注入作者定义成本，因此模型无法把合法失败前进代价放大。",
"- 新增 41 条 v1.6.2 deterministic 回归；连同既有 535 条，正式 release gate 为 576 PASS / 0 FAIL，并通过 JavaScript syntax、deterministic double build 和 single-HTML verifier。",
"- 真实 DeepSeek Run 31453752316：8 actions / 8 structured requests / 10 API attempts / 2 retries / 3 provider empty / 1 retry exhaustion / 1 graceful fallback / 0 technical leaks，最终正常 ending-solved。该样本未触发 failure-forward，因此机械正确性以 41 条 deterministic 专项为证。",
"- APP_VERSION 为 v1.6.2，Save Schema 仍为 8，AI protocol 仍为 1.3，正常成功回合不增加 API 请求；正式单 HTML 为 538000 bytes。",
"",
marker,
""
].join("\n");
if(!text.includes(marker))throw new Error("missing v1.6.1 README marker");
if(!text.includes("## v1.6.2 更新内容"))text=text.replace(marker,section);
if(!text.includes("# TRPG AI 主持助手 v1.6.2")||!text.includes("576 PASS / 0 FAIL"))throw new Error("v1.6.2 README patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V162_DOCS_PATCH:PASS");
