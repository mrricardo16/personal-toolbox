# personal-toolbox

个人 Web 小工具集合。

本仓库采用“一个工具一个目录”的轻量结构，工具可以直接用浏览器打开，不依赖 npm、框架或构建工具。

## 当前工具

### TRPG AI 主持助手 v1.2

路径：[trpg-dm-assistant/index.html](trpg-dm-assistant/index.html)

单人使用的浏览器跑团小游戏。页面负责保存角色、剧本节点、线索、状态和骰点，AI 负责主持叙事、NPC 和剧情推进。

主要能力：

- COC 7 天命五选一（.coc5）和 480 点购点（不含幸运）。
- COC HP、SAN、LUCK 派生值和百分骰检定。
- 强制检定不可跳过，非强制检定可以跳过。
- 内置多个调查悬疑短剧本，支持前情提要和节点确认。
- 支持 TXT / Markdown 剧本本地导入。
- 支持 DeepSeek、OpenAI、通义千问、Moonshot 等 OpenAI 兼容接口。
- 支持本地多槽位存档、导入和导出。

使用说明：[trpg-dm-assistant/README.md](trpg-dm-assistant/README.md)

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
