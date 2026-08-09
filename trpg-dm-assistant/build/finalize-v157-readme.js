"use strict";
const fs=require("fs");
const path=require("path");
const file=path.resolve(__dirname,"..","README.md");
let text=fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n");
text=text.replace("# TRPG AI 主持助手 v1.5.6","# TRPG AI 主持助手 v1.5.7");
text=text.replace("当前版本为 v1.5.6。","当前版本为 v1.5.7。");
const section=`## v1.5.7 更新内容

- 新增 Case Integrity Validator：启用剧本前检查节点拓扑、线索 acquisitionRoute、依赖环、关键线索单骰软锁和 Ending 静态可满足性。
- ERROR 只用于可证明的结构损坏并阻止坏剧本覆盖当前案件；不可达节点、动态 NPC/线索/flag 来源、脆弱 Ending 等使用 WARN/INFO，默认允许继续游戏。
- 新增 Interaction Availability Invariant：安全层遵循 \`BLOCK UNSAFE STATE, NOT PLAYER ACTION\`，防御机制不能让 AI 无法执行玩家的正常交互。
- v1.5.6 的玩家断言 / 多步行动 Guard 越权不再直接变成技术失败；页面本地剥离非法后续状态并生成中性叙事，继续处理第一个合法步骤。
- Guard 恢复叙事不会复述未验证的玩家断言，避免伪造 NPC 台词、世界事实或结果重新污染聊天上下文。
- 合法 check 会在恢复中保留；合法单步移动、普通调查、等待和无收益行动不会触发 recovery，未知 operation 等真正协议错误仍严格拒绝。
- AI protocol 保持 1.3，Save Schema 保持 8；不新增第二次 AI 请求，本版没有使用 DS_KEY。
- 新增 34 条 v1.5.7 专项回归，完整确定性回归达到 259 PASS / 0 FAIL。

`;
if(!text.includes("## v1.5.7 更新内容"))text=text.replace("## v1.5.6 更新内容",section+"## v1.5.6 更新内容");
text=text.replace("- v1.5.3：修复线索来源与本轮检定误绑定，显式化内置线索路线，并保持无收益行动合法。","- v1.5.7：加入 Case Integrity Validator 与 Interaction Availability Invariant，检查案件软锁风险，同时确保 Guard 只挡非法状态、不挡正常玩家交互。\n- v1.5.6：加入 Player Assertion Guard 与 Action Chaining Guard，阻止玩家完成式措辞和多步行动直接写入结果。\n- v1.5.3：修复线索来源与本轮检定误绑定，显式化内置线索路线，并保持无收益行动合法。");
text=text.replace("`src/`：v1.5.1 的模块化源码","`src/`：v1.5.7 的模块化源码");
text=text.replace("当前版本报告为 `reports/v1.5.0-test-report.md`","当前版本报告为 `reports/trpg-dm-assistant-v1.5.7-test-report.md`");
fs.writeFileSync(file,text,"utf8");
console.log("README finalized for v1.5.7");
