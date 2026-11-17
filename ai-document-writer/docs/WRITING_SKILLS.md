# 写作 Skill 架构（V0.3.0）

本模块专注于中文办公文稿的初稿质量与连续修订。代码结构采用 **自编写的本地 Markdown Skill + 白名单路由**，而非将 GitHub 高星 Skill 全量塞入 Prompt，更不会下载或执行第三方脚本。

## 内置的七项 Skill

| ID | 类别 | 适用范围 |
| --- | --- | --- |
| `draft-formal` | draft | 通用正式材料、通知、方案、请示等 |
| `draft-summary` | draft | 月报、季度/年度工作总结 |
| `draft-report` | draft | 报告、调研、简报 |
| `draft-meeting` | draft | 会议纪要 |
| `revise-targeted` | revision | 对现有稿件定向改写 |
| `improve-style` | enhancement | 中文语言风格与信息密度 |
| `review-facts` | review | 保守事实审校，不重写全文 |

所有内容位于 `skills/<skill-id>/SKILL.md`，由后端 `SkillRegistry` 显式白名单加载。构建时复制到 `skills/` 发布目录。即使用户构造未知文件名或路径，也不支持任意加载。

## 实际调用路线

- 常规写作：原有 13 类文种 Prompt 是基础。切换“本地 Skill（实验）”时，额外按文种最多加载一个主 Skill 和一个语言优化 Skill；“经典 Prompt”不附加本地 Skill。
- 年度总结：事实提取与跨月归并继续走经过验证的结构化流程，写作阶段改为先拟提纲（Skill 方案），再结合经过确认的事项与原始证据的相邻上下文写正文。
- 定向改稿：`/api/writing/revise` 接收当前正文、修改要求、修改范围、保护项和有限事实依据，调用 `revise-targeted`；选区外文字由后端程序原样拼接。
- 事实审校：如用户明确打开自动审校，则新增一版“审校稿”而非破坏初稿。

## 版本记录和边界

每次生成/审校/采纳修订保存为独立快照，最多保留当前页面内存中的最近 20 版。可以切换、比较并导出 JSON。**刷新浏览器会失去未导出的版本**；不会自动把业务文稿存到后端文件、浏览器 LocalStorage 或云端。

选区修订保证选区外代码级原样保留，并阻止候选稿删除当前文稿中的指定保护项。不能仅靠这一约束证明模型没有添加未经授权的新事实；候选稿依然必须人工核查后采纳。

## 版权与安全决策

参考研究的开源思路包括：
- [anthropics/skills](https://github.com/anthropics/skills) 的协作式文档工作流程；
- [blader/humanizer](https://github.com/blader/humanizer) 的去模板化表达思路（MIT）；
- [KaguraNanaga/official-document-writing-skill](https://github.com/KaguraNanaga/official-document-writing-skill) 的中文文种约束（MIT）；
- [duyunzhoudyz/dyz-gongwen-skills](https://github.com/duyunzhoudyz/dyz-gongwen-skills) 的公文工作流思路（PolyForm Noncommercial）。

**仓库内七个 SKILL.md 均为本项目重新编写的规则，未复制上述项目的 Skill 正文、代码或模板文件。** 特别是 Noncommercial 授权的项目，不应未经审核就打包在可分发产品中。

当前不支持从 GitHub URL 自动安装 Skill；未来如要开放，需要增加格式校验、许可审查、提示词注入处理、脚本执行禁用和供应链版本固定。

## 待业务验收

1. 同一套事实，在经典 Prompt 与本地 Skill 模式分别生成，使用相同模型与参数。
2. 盲评是否有更多有效细节，而非空泛延展、编造或格式错误。
3. 验证“只改第二段”确实不会影响其他段落，同时保护项保持原样。
4. 检查 Skill 可能造成的文种冲突、过长 Prompt 和额外 Token 费用。

参考 [WRITING_EVAL.md](WRITING_EVAL.md) 和 [ACCEPTANCE.md](ACCEPTANCE.md)。
