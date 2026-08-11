"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.6.2","# TRPG AI 主持助手 v1.6.3");
text=text.replace("当前版本为 v1.6.2。","当前版本为 v1.6.3。");
const marker="## v1.6.2 更新内容";
const section=[
"## v1.6.3 更新内容",
"",
"- 新增 SAN Loss Resolution 1.0：现有浏览器 SAN 检定与 SAN 损失数值之后，单次 SAN 冲击链继续由浏览器裁决，AI 只负责在 immutable 结果内叙述。",
"- 单次损失 0 不触发冲击；1-4 点只保留即时非自主反应语义；单次损失 >=5 时浏览器执行 INT 百分骰，INT 成功进入临时疯狂。",
"- 临时疯狂由浏览器继续生成 1D10 小时持续时间、1D10 疯狂发作类别与 1D10 轮发作时长；十项发作表固定为失忆、心因性障碍、暴力、偏执、重要之人、昏厥、惊恐逃离、歇斯底里、恐惧症、躁狂症。",
"- sanResolution 固定写入原 check record；同一记录重试 AI continuation 不重骰、不重复写历史，也不增加第二个 API round trip。",
"- 新增 character.sanityState，但继续沿用 Save Schema 8：新角色记录 creation baseline，旧存档补 legacy_current baseline；两者都明确 indefiniteTrackingReady=false，本版不伪造跨窗口不定期疯狂判定。",
"- payload/diagnostics 改为纯读取 sanityStateSnapshot，不会因为查看上下文而静默修改 canonical state 或 revision。",
"- v1.6.1 Mechanical Consequence Contract 继续阻止 continuation 再次 adjustSan，避免 SAN 损失和冲击链重复结算；防御受限时仍保持玩家交互可继续。",
"- 新增 37 条 v1.6.3 deterministic 回归；连同既有 576 条，正式 release gate 为 613 PASS / 0 FAIL，并通过 JavaScript syntax、deterministic double build 与 single-HTML verifier。",
"- 真实 DeepSeek final Run 31456000489：8 actions / 8 structured requests / 7 usable provider responses / 17 API attempts / 9 retries / 10 provider empty / 1 retry exhaustion / 1 graceful fallback / 0 technical leaks。该样本未触发 SAN 检定，因此 SAN 机械正确性以 37 条 deterministic 专项为证。",
"- Real API Acceptance 同步与 v1.5.8 Resilience 语义对齐：若浏览器 Ending Gate 已 ready 且无 missing、0 hard failure/0 leak，bounded provider fallback 后仍保持可交互，并且至少一半结构化请求真实成功，可分类为 provider-deferred ending，而不是误判规则引擎失败；最终通过样本为 7/8 成功。",
"- APP_VERSION 为 v1.6.3，Save Schema 仍为 8，AI protocol 仍为 1.3，正常成功回合不增加 API 请求；正式单 HTML 为 546989 bytes。",
"- 不定期疯狂的累计窗口、临时疯狂过期/恢复，以及 HP/重伤/濒死规则仍留在后续 v1.6.x，不把未实现内容包装成已完成。",
"",
marker,
""
].join("\n");
if(!text.includes(marker))throw new Error("missing v1.6.2 README marker");
if(!text.includes("## v1.6.3 更新内容"))text=text.replace(marker,section);
if(!text.includes("# TRPG AI 主持助手 v1.6.3")||!text.includes("613 PASS / 0 FAIL"))throw new Error("v1.6.3 README patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V163_DOCS_PATCH:PASS");
