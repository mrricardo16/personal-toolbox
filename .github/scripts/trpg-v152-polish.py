from pathlib import Path
ROOT=Path('.')
def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def once(s,a,b,label):
    if s.count(a)!=1: raise SystemExit(f'{label}: expected 1 anchor, got {s.count(a)}')
    return s.replace(a,b,1)

p='trpg-dm-assistant/src/ai-protocol.js'; s=read(p)
s=once(s,'18. 连续无进展时让既有世界主动行动，而不是给玩家正确答案。\n19. 内容边界：','18. 连续无进展时让既有世界主动行动，而不是给玩家正确答案。\n19. 不要重复换词描述同一个异常。若玩家重复做同一件事且世界没有变化，可以明确“没有新的发现”；若世界变化，变化必须来自已存在的 NPC 动机、威胁、时间或环境。\n20. 玩家明确等待、休息或进行长时间搜索时，叙事要体现时间流逝；只有能给出与当前时间一致的新值时才使用 advanceTime，不能伪造精确时间。\n21. memory.worldContinuity 是压缩后的近期世界事件与停滞状态；优先保持其连续性。memory.temporalIntent 仅说明行动是否明显耗时，不代表自动奖励、自动惩罚或自动推进。\n22. 内容边界：','system prompt')
s=once(s,'允许本轮 narrative 有内容而 stateChanges=[]、campaignChanges=[]；这不是错误，也不需要补偿线索或进度。\n输入：','允许本轮 narrative 有内容而 stateChanges=[]、campaignChanges=[]；这不是错误，也不需要补偿线索或进度。\n长团连续性：参考 memory.worldContinuity、npcContinuity、pinnedFacts 和 unresolvedQuestions；重复行动允许得到“没有新变化”。memory.temporalIntent=wait/extended_search 时应体现合理时间感，但不得因此强送线索。\n输入：','user prompt')
s=once(s,'markTurnSnapshotCommitted(requestId);state.runtime.pendingActionSuggestions=[];','recordWorldContinuityEvent(transaction,requestId);markTurnSnapshotCommitted(requestId);state.runtime.pendingActionSuggestions=[];','commit hook')
write(p,s)

p='trpg-dm-assistant/src/memory.js'; s=read(p)
s=once(s,'contextMetrics:snapshot.metrics,loreSelection:snapshot.loreSelection,storage:appStorageStats()','contextMetrics:snapshot.metrics,longSessionDiagnostics:includeSecrets?snapshot.diagnostics:undefined,loreSelection:snapshot.loreSelection,storage:appStorageStats()','diagnostic package')
s=once(s,'${section("NPC 连续性",snapshot.npcContinuity)}','${section("NPC 连续性",snapshot.npcContinuity)}${debug?section("世界连续性",snapshot.worldContinuity):""}${debug?section("长团诊断",snapshot.diagnostics||{}):""}','context viewer')
write(p,s)

report='''# TRPG DM Assistant v1.5.2 测试报告

## 发布目标

强化 30～50 轮以上调查中的世界连续性与可观测性，减少重复叙事、无来源推进和长上下文噪声；引入真实 API 长团验收，但不扩展战斗、追逐或完整疯狂规则。

## 核心变化

- 最近世界事件压缩为固定长度时间线，作为 AI 长团上下文。
- 记录最近叙事指纹；高度重复时不拒绝事务，而是在后续主持指令中要求停止换词复述。
- 等待、休息、长时间搜索识别为 temporalIntent，仅影响主持时间感，不自动奖励或惩罚。
- 5+ 轮停滞优先驱动已有 NPC、威胁、时钟和环境，不强送关键线索或正确答案。
- 上下文增加 worldContinuity，聊天历史单独按剩余预算裁剪。
- KP 调试模式增加长团诊断：层级优先级、消息裁剪、Lore/NPC/世界事件数量、回合影响和重复度。
- 普通诊断包不包含内部长团诊断。
- 新增 100 轮确定性压力样本。
- 新增真实 API 20/50 轮验收脚本与手动工作流；API Key 只从 GitHub Secret 读取。

## 验收

正式发布要求：全部旧回归、v1.5.2 长团测试、JS 语法、构建、确定性产物、唯一 HTML、diff check 与一次真实 API 20 轮验收全部通过。
'''
write('trpg-dm-assistant/reports/v1.5.2-test-report.md',report)

p='trpg-dm-assistant/README.md'; s=read(p)
s=once(s,'# TRPG AI 主持助手 v1.5.1','# TRPG AI 主持助手 v1.5.2','title')
s=once(s,'当前版本为 v1.5.1。','当前版本为 v1.5.2。','current')
section='''## v1.5.2 更新内容

- 增加固定长度世界事件时间线，让长团上下文记住最近真正发生过的变化，而不是依赖完整聊天。
- 增加叙事重复度检测；高重复不会让整轮报错，而会在后续主持指令中要求停止换词复述，允许明确“没有新发现”。
- 识别等待、休息与长时间搜索的时间意图，只要求合理时间感，不自动给予线索、进度或惩罚。
- 连续停滞时优先驱动已有 NPC、威胁、时钟与环境，不创建无来源的新谜团或正确答案。
- 上下文新增 worldContinuity，并把最近聊天改为剩余预算内裁剪，保证固定事实、NPC 连续性和世界时间线优先。
- KP 调试模式新增长团诊断；普通玩家和普通诊断包不暴露内部重复度与优先级信息。
- 新增 100 轮确定性长团压力测试，以及使用 GitHub Secret 的真实 API 20/50 轮验收脚本。

'''
s=once(s,'## v1.5.1 更新内容',section+'## v1.5.1 更新内容','section')
s=once(s,'## 版本记录\n\n- v1.5.1：','## 版本记录\n\n- v1.5.2：强化长团世界连续性、重复叙事治理、时间意识与真实 API 压力验收。\n- v1.5.1：','version record')
old='- `reports/v1.5.1-test-report.md`：当前版本测试报告。'
if old in s: s=once(s,old,'- `reports/v1.5.2-test-report.md`：当前版本测试报告。\n- `reports/v1.5.1-test-report.md`：上一版本测试报告。','report listing')
write(p,s)

p='README.md'; s=read(p); s=s.replace('v1.5.1','v1.5.2',1); write(p,s)
print('v1.5.2 polish patch applied')
