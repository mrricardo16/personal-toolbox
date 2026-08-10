"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../README.md");
let text=fs.readFileSync(file,"utf8");
text=text.replace("# TRPG AI 主持助手 v1.5.10","# TRPG AI 主持助手 v1.5.11");
text=text.replace("当前版本为 v1.5.10。","当前版本为 v1.5.11。");
const marker="## v1.5.10 更新内容";
const section=`## v1.5.11 更新内容

- 新增 NPC Knowledge Boundary：剧本作者可通过 \`director.knowledgeFacts\` 声明受保护事实、初始知情 NPC（\`knownBy\`）以及合法线索传播来源（\`learnableFromClueIds\`）；AI 的 KP 全知上下文不再自动等于 NPC 知识。
- NPC continuity 新增浏览器持有的 \`knownFactIds / knownClueIds\`。作者声明的初始知识随 NPC 实体化进入运行态，旧 Schema 8 存档缺字段时自动归一，无需迁移。
- 玩家可以真实地把已获得线索告诉 NPC：只有线索已揭示、当前行动明确向目标 NPC 出示/转述该线索、且事实声明了对应来源时，浏览器才允许知识传播。
- \`learnClueIds / learnFactIds\` 只是 AI 提议；浏览器校验通过后才转为内部可信字段。AI 直接伪造内部 knowledge 字段或验证标记会被清除，不能绕过权限边界。
- 支持合法的 knowledge-only \`updateNpc\`：例如“把账本给管家看”可以只改变 NPC 已知信息，不需要伪造 attitude / claim / lastInteraction 来满足旧协议字段要求。
- NPC 若把未知的受保护事实写入 claim/description/lastInteraction，非法字段会本地剥离；同一操作中的合法 relationship 等更新以及同回合其它合法状态变化继续执行。
- NPC 叙事越权泄密会局部中和，但“我不知道 / 无法确认”、拒绝、猜测、撒谎和普通社交互动不会被知识防御误杀，继续遵循 \`BLOCK UNSAFE STATE, NOT PLAYER ACTION\`。
- “旧宅失踪案”加入首组 authored knowledge facts：管家可以知道书房暗门，但不会因为 KP 知道真相而自动知道地下遗体实验；更深事实需要对应线索传播或作者初始授权。
- authored knowledge 配置在剧本启用前静态校验 fact ID、NPC/clue 引用和 alias 歧义；坏配置不会覆盖当前案件。
- 修复 \`normalizeDirectorSituation\` 原本会丢弃新 \`knowledgeFacts\` 的集成问题，并为经过浏览器验证的 knowledge-only NPC 更新增加窄提交路径；没有放宽普通 \`updateNpc\` 或未知 operation 的权限。
- Save Schema 保持 8、AI protocol 保持 1.3，不增加 API 请求；新增 34 条 v1.5.11 确定性回归，永久套件目标为 375 PASS / 0 FAIL。

`;
if(!text.includes("## v1.5.11 更新内容")){
  if(!text.includes(marker))throw new Error("README v1.5.10 marker missing");
  text=text.replace(marker,section+marker);
}
if(!text.startsWith("# TRPG AI 主持助手 v1.5.11"))throw new Error("README title patch failed");
if(!text.includes("当前版本为 v1.5.11。"))throw new Error("README current version patch failed");
fs.writeFileSync(file,text,"utf8");
console.log("V1511_README_PATCH:PASS");
