"use strict";
const fs=require("fs"),path=require("path");
const root=process.cwd(),p=(...x)=>path.join(root,...x);
function read(file){return fs.readFileSync(file,"utf8")}
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,"utf8")}
function once(text,from,to,label){const i=text.indexOf(from);if(i<0)throw new Error(`FINALIZE_MISS ${label}`);if(text.indexOf(from,i+from.length)>=0)throw new Error(`FINALIZE_AMBIGUOUS ${label}`);return text.slice(0,i)+to+text.slice(i+from.length)}

const productReadme=p("trpg-dm-assistant/README.md");
let readme=read(productReadme);
readme=once(readme,"# TRPG AI 主持助手 v1.5.2","# TRPG AI 主持助手 v1.5.3","product readme title");
readme=once(readme,"当前版本为 v1.5.2。","当前版本为 v1.5.3。","product readme intro");
const section=`## v1.5.3 更新内容

- 修复检定续写中的线索来源误绑定：内部 currentCheckRecordId 只作为本轮上下文，不再自动抢占所有受保护线索的来源判定。
- 显式 sourceRouteId 现在优先按对应路线校验；automatic / flag / npc / clue 路线不会因为本轮存在无关检定而被错误拒绝。
- 显式 sourceCheckRecordId 仍保持严格校验，错误或无关的检定记录不会被静默放行。
- failure_forward 路线绑定具体 checkId，不能借用另一项无关失败检定来获取当前线索。
- 5 个内置模组的 22 个隐藏线索改为显式获取路线；“无灯列车”的 train-map-fragment 明确绑定 train-spot，不再依赖关键词猜测。
- 保持 v1.5.x 的开放调查原则：本轮可以只有自然叙事而没有线索、状态变化或调查进度；发生过检定也不意味着必须产生线索。
- 新增 v1.5.3 线索路线回归测试，覆盖 automatic、flag、显式/上下文检定、失败前进和 train-map-fragment 原始故障场景。
- 存档 Schema 保持 8，无需迁移。

`;
readme=once(readme,"## v1.5.2 更新内容",section+"## v1.5.2 更新内容","product readme section");
readme=once(readme,"- v1.5.2：强化长团世界连续性、重复叙事治理、时间意识与真实 API 压力验收。","- v1.5.3：修复线索来源与本轮检定误绑定，显式化内置线索路线，并保持无收益行动合法。\n- v1.5.2：强化长团世界连续性、重复叙事治理、时间意识与真实 API 压力验收。","product version record");
write(productReadme,readme);

const rootReadme=p("README.md");
let rootText=read(rootReadme);
rootText=once(rootText,"### TRPG AI 主持助手（最新版 v1.5.2）","### TRPG AI 主持助手（最新版 v1.5.3）","root title");
rootText=once(rootText,"- AI JSON 解析加入真实脏响应语料回归，常见格式漂移由本地确定性修复处理，非法业务操作仍整体拒绝。","- AI JSON 解析加入真实脏响应语料回归，常见格式漂移由本地确定性修复处理，非法业务操作仍整体拒绝。\n- v1.5.3 修复线索来源与本轮检定误绑定；内置隐藏线索使用显式获取路线，同时继续允许没有线索、状态或进度的自然叙事回合。","root capability");
rootText=once(rootText,"- v1.5.1：稳定调查主循环，允许无收益行动，加入 NPC 连续性与上下文优先级治理。","- v1.5.3：修复线索来源误绑定，显式化内置线索路线，保持无收益行动与严格线索保护并存。\n- v1.5.2：强化长团世界连续性、重复叙事治理、时间意识与真实 API 压力验收。\n- v1.5.1：稳定调查主循环，允许无收益行动，加入 NPC 连续性与上下文优先级治理。","root version record");
write(rootReadme,rootText);

const ciPath=p(".github/workflows/trpg-ci.yml");
let ci=read(ciPath);
ci=once(ci,"      - name: v1.5.2 long-session regression\n        run: node trpg-dm-assistant/build/test-v152-long-session.js\n","      - name: v1.5.2 long-session regression\n        run: node trpg-dm-assistant/build/test-v152-long-session.js\n\n      - name: v1.5.3 clue-route regression\n        run: node trpg-dm-assistant/build/test-v153-clue-routes.js\n","permanent CI");
write(ciPath,ci);

const report=`# TRPG AI 主持助手 v1.5.3 测试报告

## 版本

- 应用版本：v1.5.3
- 存档 Schema：8
- 产品入口：\`trpg-dm-assistant/outputs/trpg-dm-assistant.html\`
- 本次为线索授权与开放调查语义热修，不修改存档结构。

## 故障

旧版本在检定续写阶段会把内部 \`currentCheckRecordId\` 自动当成 \`revealClue\` 的来源。若目标线索实际允许 automatic、flag、npc 或 clue 路线，而本轮恰好发生了另一项无关检定，授权器会先尝试用该检定匹配线索，随后错误抛出“检定记录不属于线索获取路线”。

已确认的实际案例为“无灯列车”的 \`train-map-fragment\`。

## 修复

- \`sourceRouteId\` 显式路线优先校验。
- 用户/AI 显式提供的 \`sourceCheckRecordId\` 继续严格校验，不放宽越权保护。
- 内部 \`currentCheckRecordId\` 只作为上下文候选：只有它与某条 check 路线匹配且满足成功等级时才授权。
- 上下文检定无关或失败时，继续检查合法的 automatic / flag / npc / clue 备选路线，而不是直接拒绝。
- failure-forward 路线绑定具体 \`checkId\`，拒绝借用无关失败骰。
- 5 个内置模组共 22 个隐藏线索使用显式路线；\`train-map-fragment\` 明确绑定 \`train-spot\`。
- AI 协议提示要求非检定路线使用 \`sourceRouteId\`，避免附带无关 \`sourceCheckRecordId\`。

## 与开放调查原则的关系

本次修复不要求任何行动产生线索。\`narrative\` 有内容而 \`stateChanges=[]\`、\`campaignChanges=[]\` 仍是合法响应。检定发生本身也不构成“本轮必须推进”的理由。

线索保护仍然严格：没有合法路线时仍拒绝；显式错误检定来源仍拒绝；失败检定在没有失败前进或其他合法路线时仍不能揭示受保护线索。

## 回归测试

新增 \`build/test-v153-clue-routes.js\`，17 项全部通过，覆盖：

- 全部内置隐藏线索存在显式路线。
- 所有显式 check/failure-forward 引用同节点真实检定。
- \`train-map-fragment -> train-spot\` 原始故障回归。
- 无关上下文检定不阻断 automatic / flag 路线。
- 显式 sourceRouteId 优先级。
- 显式错误 sourceCheckRecordId 继续拒绝。
- 匹配成功检定正常授权。
- 失败检定不会抢占合法 automatic 备选路线。
- 无备选路线的失败检定继续拒绝。
- failure-forward 拒绝无关失败骰，并接受绑定的失败骰。
- 无收益自然叙事协议仍被明确允许。

发布门禁同时通过既有安全、存档、CoC 判定、态势 UI、AI JSON 修复、v1.5.0、v1.5.1、v1.5.2 回归，以及全部 JavaScript 语法、单 HTML 构建、成品验证、连续构建一致性、唯一产品 HTML 和 \`git diff --check\`。

## API

本次缺陷是页面端确定性授权逻辑，可完全本地复现，因此没有额外消耗真实 API 额度。v1.5.2 建立的手动 20/50 轮真实 API 验收仍保留。
`;
write(p("trpg-dm-assistant/reports/v1.5.3-test-report.md"),report);

console.log("FINALIZE_V153_DONE");
