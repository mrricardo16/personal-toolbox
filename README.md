# personal-toolbox

个人 Web 小工具集合。

本仓库采用“一个工具一个目录”的轻量结构，工具可以直接用浏览器打开，不依赖 npm、框架或构建工具。

## 当前工具

### TRPG AI 主持助手（最新版 v1.4.1）

路径：[trpg-dm-assistant/index.html](trpg-dm-assistant/index.html)

单人使用的浏览器跑团小游戏。页面负责保存角色、剧本节点、线索、状态和骰点，AI 负责主持叙事、NPC 和剧情推进。

主要能力：

- COC 7 天命五选一（.coc5）和 480 点购点（不含幸运）。
- COC HP、SAN、LUCK 派生值和百分骰检定。
- 支持明骰、暗骰、节点进入检定、行动触发检定和强制/非强制检定。
- 强制 SAN Check、侦查等节点检定由页面规则驱动，非强制明骰可以跳过。
- 严格校验 AI 状态变化协议，初始请求失败后可安全重试或返回行动阶段。
- 支持请求提示、案件方向回顾和一次性 KP 方向提示。
- 增加场景连续性保护，阻止未经确认的地点跳转和重复门/房间循环。
- 配置页提供模型下拉选择、跑团温度预设、上下文预算说明和推荐配置。
- 内置多个调查悬疑短剧本，支持前情提要和节点确认。
- 支持 TXT / Markdown 剧本本地导入。
- 支持 DeepSeek、OpenAI、通义千问、Moonshot 等 OpenAI 兼容接口。
- 支持本地多槽位存档、导入和导出。

使用说明：[trpg-dm-assistant/README.md](trpg-dm-assistant/README.md)

版本记录：

- v1.4.1：加入请求提示、场景连续性保护、导航历史、模型/温度预设和 Schema 7 存档迁移。
- v1.3.2：加入明骰/暗骰与节点检定触发，强化 SAN Check，修复非法 stateChanges 导致的卡死，并增加安全重试。
- v1.2：完成 COC 创角、预设剧本、浏览器骰点、节点确认和本地存档闭环。

本仓库始终只保留一个 TRPG 产品入口；`trpg-dm-assistant/index.html` 始终指向最新版。

### AI 文档助手

路径：[`ai-document-writer/index.html`](ai-document-writer/index.html)

基于 DeepSeek API 的单文件文档生成工具，支持：

- 文档技能切换
- 正式材料生成
- 专有名词保护
- 自动审校
- Markdown 和 TXT 下载

使用说明见 [ai-document-writer/README.md](ai-document-writer/README.md)。

### 工业场景相机可照范围计算器

路径：[`camera-fov-calculator/index.html`](camera-fov-calculator/index.html)

用于计算工业场景下相机的可照范围，以及考虑货位尺寸、间隔和每边误差余量后可照货位数量，并绘制货位布局示意图。

使用说明见 [camera-fov-calculator/README.md](camera-fov-calculator/README.md)。

## 未来扩展

后续可以继续增加独立工具目录，例如：

- JSON 工具
- SQL 工具
- Markdown 工具
- 图片工具
- AI 辅助工具

新增工具时，请为每个工具建立独立目录，并提供自己的 `index.html` 与 `README.md`。

## 安全与使用边界

- 不要把个人 API Key 上传到仓库。
- 不要把涉密资料或不允许发送至外部服务的材料输入工具。
- API 费用由使用者自行承担。
