# ChatInsight：微信 / QQ 实时会话注解工具需求与架构方案

> 版本：V0.1 需求冻结稿  
> 目标平台：Windows  
> 首发客户端：微信 PC  
> 后续适配：QQ PC

---

## 1. 项目定位

ChatInsight 是一个 Windows 桌面端实时会话注解工具。

它不负责自动回复，也不自动发送消息。其核心目标是：

> 读取当前聊天会话的上下文，对每一条“对方消息”生成简短的隐含情绪 / 语义解读，并以类似聊天旁白的灰色卡片形式展示。

示例：

```text
对方：你今天是不是又忘了我跟你说过什么？

┌ AI
│ 她这句更像是在：
│
│ 确认你是否重视这件事   68%
│ 单纯确认你记不记得     17%
│ 已经有明显不满         15%
│
│ 当前更偏向“希望你自己想起来”。
└────────────────────
```

下一条消息：

```text
我：记得，让我自己想。

对方：你最好是。

┌ AI
│ “你最好是”更接近什么语气？
│
│ 半信半疑        56%
│ 带一点警告意味  31%
│ 单纯开玩笑      13%
│
│ 有轻微不满，但还在等你的回答。
└────────────────────
```

其中百分比定义为：

> 模型对若干候选解释的相对权重，而不是对对方真实心理状态的客观概率测量。

---

## 2. V0.1 需求冻结

| 项目 | V0.1 定义 |
|---|---|
| 支持平台 | Windows |
| 首发客户端 | 微信 PC |
| 后续客户端 | QQ PC |
| 分析对象 | 当前打开会话中的“对方消息” |
| 分析粒度 | 一条聊天消息，不按句号拆句 |
| 上下文 | 当前消息之前最近 8～12 条 |
| 分析时机 | 检测到新的对方消息后自动分析 |
| 展示形式 | 消息附近的灰色 AI 注解卡片 |
| 输出内容 | 2～3 种解释 + 相对权重 + 一句话总结 |
| 自己消息 | 作为上下文使用，但不生成卡片 |
| 历史回溯 | 第一版不重新修改旧分析 |
| 长期记忆 | 不做 |
| 联系人画像 | 不做 |
| 自动回复 | 不做 |
| 自动发送 | 不做 |
| 图片 / 语音 | 第一版不做 |
| 群聊 | 第一版不做 |
| 数据保存 | 默认只存在内存 |
| AI | 云模型优先，后续可增加本地模型 |

---

## 3. 核心产品行为

程序运行后：

```text
微信 / QQ 当前聊天
        ↓
读取当前可见消息及最近上下文
        ↓
区分自己 / 对方
        ↓
检测新消息并去重
        ↓
若是自己消息：
    只进入上下文
        ↓
若是对方消息：
    取最近 8～12 条上下文
        ↓
调用 LLM 分析当前消息
        ↓
得到 2～3 个解释 + 权重 + 总结
        ↓
在对应消息附近显示 AI 注解卡片
```

原则：

1. 每一条对方消息独立分析一次。
2. 分析当前消息时允许使用此前上下文。
3. 不对自己发送的消息生成卡片。
4. 第一版不根据后续消息回头修改旧分析。
5. 不将模型推断描述为确定事实。

---

## 4. 总体架构

技术选型：

- .NET 8
- WPF
- Windows UI Automation
- Windows Graphics Capture
- OCR Fallback
- LLM API
- 可选内存缓存 / SQLite（后续）

总体结构：

```text
┌──────────────── 微信 / QQ ────────────────┐
│                                           │
│  对方消息                                 │
│  自己消息                                 │
│  对方消息                                 │
│                                           │
└───────────────────────────────────────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │   Chat Adapter      │
          │                     │
          │ WeChatAdapter       │
          │ QQAdapter           │
          └─────────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Capture Engine      │
          │                     │
          │ UI Automation       │
          │ OCR Fallback        │
          └─────────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Message Normalizer  │
          │                     │
          │ 谁发的              │
          │ 消息内容            │
          │ 消息位置            │
          │ 去重                │
          └─────────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Conversation State  │
          │                     │
          │ 当前联系人          │
          │ 最近 8~12 条消息    │
          │ 已分析消息          │
          └─────────┬───────────┘
                    │
             新的“对方消息”
                    │
                    ▼
          ┌─────────────────────┐
          │ Emotion Analyzer    │
          │                     │
          │ LLM Provider        │
          │ JSON Schema         │
          │ Analysis Cache      │
          └─────────┬───────────┘
                    │
                    ▼
          ┌─────────────────────┐
          │ Overlay Engine      │
          │                     │
          │ 消息位置跟踪        │
          │ AI 卡片渲染         │
          │ 滚动同步            │
          └─────────────────────┘
```

架构原则：

> “微信 / QQ 怎么读取消息”必须和“AI 怎么分析消息”彻底解耦。

以后新增 QQ 只替换 Adapter / Capture 适配层，不修改 Conversation、AI、Overlay 的核心逻辑。

---

## 5. 推荐项目结构

建议初期保持简单：

```text
ChatInsight/
│
├─ src/
│  ├─ ChatInsight.App
│  │   ├─ App.xaml
│  │   ├─ MainWindow.xaml
│  │   └─ OverlayWindow.xaml
│  │
│  ├─ ChatInsight.Core
│  │   ├─ Models/
│  │   │   ├─ ChatMessage.cs
│  │   │   ├─ ChatSession.cs
│  │   │   └─ MessageAnalysis.cs
│  │   │
│  │   ├─ Conversation/
│  │   │   └─ ConversationBuffer.cs
│  │   │
│  │   └─ Interfaces/
│  │       ├─ IChatAdapter.cs
│  │       ├─ IMessageAnalyzer.cs
│  │       └─ IAnalysisCache.cs
│  │
│  ├─ ChatInsight.Capture
│  │   ├─ UIAutomation/
│  │   │   └─ UiaCaptureService.cs
│  │   ├─ OCR/
│  │   │   └─ OcrCaptureService.cs
│  │   └─ WindowTracker.cs
│  │
│  ├─ ChatInsight.AI
│  │   ├─ LlmAnalyzer.cs
│  │   ├─ PromptBuilder.cs
│  │   └─ Providers/
│  │       ├─ OpenAIProvider.cs
│  │       └─ DeepSeekProvider.cs
│  │
│  └─ ChatInsight.Overlay
│      ├─ OverlayManager.cs
│      ├─ MessageAnchor.cs
│      └─ AnalysisCard.xaml
│
└─ tests/
```

V0.1 实际实现时可以先只拆成：

```text
App
Core
Capture
AI
```

QQ 接入后再把 Adapter 单独拆项目。

---

## 6. 核心数据模型

### 6.1 ChatMessage

```csharp
public sealed class ChatMessage
{
    public string Id { get; init; } = default!;

    public string ConversationId { get; init; } = default!;

    public MessageSender Sender { get; init; }

    public string Text { get; init; } = default!;

    public DateTime ObservedAt { get; init; }

    public Rect Bounds { get; init; }

    public MessageAnalysis? Analysis { get; set; }
}

public enum MessageSender
{
    Me,
    Other
}
```

### 6.2 MessageAnalysis

```csharp
public sealed class MessageAnalysis
{
    public string Title { get; init; } = default!;

    public IReadOnlyList<Interpretation> Interpretations { get; init; }
        = [];

    public string Summary { get; init; } = default!;

    public string Confidence { get; init; } = default!;
}

public sealed class Interpretation
{
    public string Label { get; init; } = default!;

    public int Weight { get; init; }
}
```

典型返回：

```json
{
  "title": "“你最好是”更接近什么语气？",
  "interpretations": [
    {
      "label": "半信半疑",
      "weight": 55
    },
    {
      "label": "轻微不满",
      "weight": 30
    },
    {
      "label": "单纯开玩笑",
      "weight": 15
    }
  ],
  "summary": "她还在等待你的回答，但并没有完全相信。",
  "confidence": "medium"
}
```

UI 只消费结构化分析结果，不理解模型 Prompt。

---

## 7. Chat Adapter

定义统一接口：

```csharp
public interface IChatAdapter
{
    bool IsAvailable();

    ChatSession? GetCurrentSession();

    IReadOnlyList<ChatMessage> GetVisibleMessages();

    event EventHandler<ChatMessage> MessageReceived;
}
```

实现：

```text
IChatAdapter
├─ WeChatAdapter
└─ QQAdapter
```

Adapter 的职责仅限：

- 定位目标应用窗口。
- 定位当前聊天会话。
- 获取当前可见消息。
- 区分消息发送方。
- 返回标准化消息及其屏幕坐标。

它不负责：

- AI 分析。
- Prompt。
- Overlay 渲染。
- 长期上下文。

---

## 8. Capture Engine

这是 V0.1 最大技术风险。

读取优先级：

| 优先级 | 技术 | 用途 |
|---|---|---|
| P1 | Windows UI Automation | 主方案 |
| P2 | Windows Graphics Capture + OCR | UIA 读不到消息时兜底 |
| P3 | 手动框选 / 热键 OCR | 调试及最终保险方案 |

### 8.1 UI Automation 主方案

第一步不是开发完整应用，而是验证当前微信 PC 是否把聊天文本暴露给 UI Automation。

理想结构：

```text
微信窗口
└─ MessageList
   ├─ Message
   │  ├─ Text = "你好"
   │  └─ Bounds
   ├─ Message
   │  ├─ Text = "你今天是不是忘了？"
   │  └─ Bounds
```

如果能直接拿到：

- 文本
- Bounds
- 消息顺序
- 控件属性

则优先使用 UIA，不需要 OCR。

### 8.2 OCR Fallback

如果 UIA 只能得到大量自绘 Pane：

```text
Pane
└─ Pane
   └─ Pane
```

而拿不到消息文本，则切换：

```text
Windows Graphics Capture
            ↓
只截图聊天区域
            ↓
OCR
            ↓
检测文字块
            ↓
根据位置判断左右
            ↓
恢复消息顺序
```

初始规则可以根据聊天区域中线判断：

```text
文字中心偏左 → 对方
文字中心偏右 → 自己
```

正式实现再结合：

- 头像位置
- 气泡区域
- OCR BoundingBox
- 消息垂直顺序

提高准确率。

### 8.3 禁止路线

V0.1 明确不采用：

- DLL Injection
- Hook 微信内部函数
- 读取 / 解密微信私有数据库
- 内存 Offset 逆向
- 内部 RPC 逆向

原因：

- 客户端更新后极易失效。
- 维护成本高。
- 风控和兼容风险明显。
- 不符合本项目“桌面伴随式工具”的目标。

---

## 9. 消息检测机制

禁止使用高频死循环：

```csharp
while (true)
{
    Screenshot();
    OCR();
    Analyze();
}
```

推荐流程：

```text
窗口 / UI 发生变化
        ↓
Debounce 300~500 ms
        ↓
读取当前可见消息
        ↓
与上一份 Snapshot 比较
        ↓
找出新增消息
        ↓
加入 ConversationBuffer
```

示例：

```text
旧状态：
A
B
C
D

新状态：
A
B
C
D
E

新增：
E
```

只处理 E，不重新分析 A～D。

---

## 10. 消息去重

不能简单使用：

```text
SHA256(Text)
```

因为：

```text
哈哈
哈哈
哈哈
```

可能是三条真实消息。

优先级：

1. UIA 如果存在稳定 RuntimeId，优先使用。
2. 否则自行维护会话内消息序列。
3. 综合 ConversationId、Sender、Text、位置、观察顺序进行匹配。

建议内部状态：

```text
Session
├─ Message 101
├─ Message 102
├─ Message 103
└─ Message 104
```

用户执行以下操作时不得重复分析：

- 上滚历史消息。
- 下滚回当前消息。
- 切换联系人。
- 切走后重新切回来。
- 窗口尺寸变化。

---

## 11. ConversationBuffer

ConversationBuffer 只维护短期上下文。

例如：

```text
M01 她：周末出去吃饭？
M02 我：可以啊
M03 她：但是这次你安排
M04 我：行
M05 她：你今天是不是又忘了我说什么？
```

分析 M05：

```text
Context:
M01
M02
M03
M04

Target:
M05
```

再收到：

```text
M06 我：我知道
M07 她：那你说
```

分析 M07 时使用最近 8～12 条：

```text
Context:
最近 8～12 条

Target:
M07
```

第一版不上传完整历史聊天记录。

---

## 12. AI 分析层

接口：

```csharp
public interface IMessageAnalyzer
{
    Task<MessageAnalysis> AnalyzeAsync(
        IReadOnlyList<ChatMessage> context,
        ChatMessage target,
        CancellationToken cancellationToken);
}
```

推荐内部结构：

```text
IMessageAnalyzer
       │
       └── LlmMessageAnalyzer
                 │
                 └── ILlmProvider
                       ├─ OpenAI
                       ├─ DeepSeek
                       └─ Local
```

目标：

- Capture 不依赖模型品牌。
- UI 不依赖模型品牌。
- 可通过配置切换 LLM Provider。

---

## 13. Prompt 约束

Prompt 不应询问：

> “她真正怎么想？”

应该定义成：

> 基于已有文本，上下文支持哪些合理解释？

基础约束：

```text
你是即时通讯语境分析器。

根据目标消息以及目标消息之前的对话上下文，
分析目标消息可能存在的语气、隐含情绪和隐含含义。

要求：

1. 只分析目标消息。
2. 上下文只作为解释依据。
3. 输出 2~3 个合理解释。
4. 权重之和必须为 100。
5. 权重表示不同解释之间的相对可能性，
   不代表对方真实心理概率。
6. 信息不足时必须降低置信度。
7. 不得虚构对方经历、人格、动机。
8. 不生成回复建议。
9. 总结保持一句话。
10. 输出严格 JSON。
```

示例 Schema：

```json
{
  "title": "string",
  "interpretations": [
    {
      "label": "string",
      "weight": 0
    }
  ],
  "summary": "string",
  "confidence": "low | medium | high"
}
```

---

## 14. Overlay UI

### 14.1 V0.1 采用锚定 Overlay

外挂程序无法直接改变微信原生消息列表的布局，因此不能真的把微信下一条消息向下推开。

第一版采用透明 TopMost 窗口，在对应消息附近绘制 AI 卡片。

示例：

```text
她：你最好是。        ┌──────────────┐
                      │ 半信半疑 55% │
                      │ 轻微不满 30% │
                      │ 单纯玩笑 15% │
                      └──────────────┘
```

WPF 窗口属性：

```text
WindowStyle=None
AllowsTransparency=True
Topmost=True
ShowInTaskbar=False
```

通过 Win32 API 实现：

- 不抢焦点。
- 可选鼠标穿透。
- 跟随微信移动。
- 微信最小化时隐藏。
- 微信滚动时同步卡片位置。

### 14.2 MessageAnchor

```text
MessageAnchor
{
    MessageId
    Bounds
    Analysis
}
```

OverlayManager 负责将 MessageAnchor 映射为卡片位置。

### 14.3 后续可选 Insight View

若希望真正实现：

```text
消息
AI
消息
AI
消息
AI
```

可增加独立“聊天镜像分析视图”：

```text
┌────── ChatInsight ──────┐

她：你是不是忘了？

AI：
想确认你是否记得   70%
有些不满           30%

我：我记得。

她：那你说。

AI：
等待明确回答       82%
开始不耐烦         18%

└─────────────────────────┘
```

该模式不修改微信 UI，只镜像当前聊天内容。

V0.1 不要求实现。

---

## 15. 完整运行流程

```text
微信新消息出现
       ↓
WindowTracker 收到变化
       ↓
等待 300~500ms
       ↓
WeChatAdapter 获取可见消息
       ↓
MessageNormalizer 标准化
       ↓
MessageTracker 去重
       ↓
发现新消息 M102
       ↓
Sender == Other ?
       │
       ├─ No → 只加入上下文
       │
       └─ Yes
            ↓
ConversationBuffer 获取前 8~12 条
            ↓
MessageAnalyzer
            ↓
LLM Provider
            ↓
严格 JSON
            ↓
MessageAnalysis
            ↓
AnalysisCache
            ↓
OverlayManager
            ↓
在该消息附近显示灰色分析卡片
```

---

## 16. 隐私与日志

默认策略：

```text
聊天原文
    ↓
只保存在进程内存
    ↓
只发送最近 N 条给 AI
    ↓
分析完成
    ↓
不落本地数据库
```

普通日志只记录：

```text
2026-09-22 15:30
Message detected
MessageId=M102
Analyze=Success
Latency=1230ms
```

默认禁止记录：

```text
她：xxxxxx
```

开发阶段可配置：

```text
EnableSensitiveLogging=true
```

默认值必须为：

```text
false
```

---

## 17. V0.1 明确范围

### 做

- Windows。
- 微信 PC。
- 单聊。
- 纯文字。
- 当前打开的会话。
- 对方消息逐条分析。
- 自己消息作为上下文。
- 最近 8～12 条上下文。
- 2～3 个隐含解释。
- 相对权重。
- 一句话总结。
- 灰色 Overlay 注解卡片。
- 云端 LLM。
- UIA 主方案。
- OCR Fallback。

### 不做

- 自动回复。
- 自动发送。
- 长期人格画像。
- 长期关系趋势。
- 联系人长期记忆。
- 群聊。
- 图片语义理解。
- 语音识别。
- 表情包理解。
- 多语言优化。
- 后台扫描所有会话。
- DLL 注入。
- Hook。
- 微信数据库逆向。
- 客户端内部协议逆向。

---

## 18. POC 与实施顺序

### P0：Capture POC

目标：

```text
找到微信窗口
↓
定位当前聊天区域
↓
枚举 UI Automation Tree
↓
打印当前可见消息文本和 Bounds
```

期望输出：

```text
OTHER
"你今天是不是忘了？"
X=320 Y=242 W=241 H=46

ME
"没有啊"
X=721 Y=321 W=89 H=44
```

决策：

- UIA 能稳定读取 → 继续使用 UIA。
- UIA 无法稳定读取 → 立即切 OCR。
- 不在 UIA 失败后转向 DLL Hook / 逆向。

### P1：Analyzer POC

暂时人工构造：

```text
List<ChatMessage>
```

验证：

```text
上下文
→ LLM
→ JSON
→ MessageAnalysis
```

目标：

- JSON 输出稳定。
- 权重和为 100。
- 能控制过度脑补。
- 单次分析延迟可接受。

### P2：Pipeline

串联：

```text
Capture
+
Message Tracker
+
ConversationBuffer
+
AI
```

先只输出 Console，不做 Overlay。

### P3：Overlay

实现：

- WPF 透明窗。
- 消息锚定。
- 微信移动同步。
- 微信滚动同步。
- 最小化隐藏。
- 卡片显示与销毁。

### P4：QQ Adapter

微信链路稳定后再增加：

```text
QQAdapter : IChatAdapter
```

AI、Conversation、Overlay 不改。

---

## 19. MVP 验收标准

V0.1 满足以下条件即视为 MVP 完成：

1. 启动程序后可识别微信 PC 主窗口。
2. 打开一个单聊后可识别当前会话。
3. 能读取当前可见纯文字消息。
4. 能正确区分自己和对方。
5. 自己发送的消息只进入上下文，不调用分析。
6. 对方发送新消息后，1～3 秒内出现分析结果。
7. 每一条对方消息最多调用一次模型。
8. 每个分析卡片与对应消息绑定。
9. 上滚 / 下滚不会重复分析历史消息。
10. 切换联系人后 ConversationBuffer 随会话切换。
11. 切回旧联系人不会重复分析已处理消息。
12. 微信窗口移动后 Overlay 能重新定位。
13. 微信窗口最小化后 Overlay 自动隐藏。
14. 模型异常时不影响微信正常使用。
15. 网络或 LLM API 失败时允许显示简短失败状态并可重试。
16. 默认日志不记录聊天原文。

---

## 20. 风险与优先级

### 风险 1：微信 UIA 可访问性不足

这是最高优先级风险。

必须通过 P0 在正式开发前验证。

处理：

```text
UIA 可读 → 主方案
UIA 不可读 → OCR
```

### 风险 2：OCR 消息重建不稳定

可能遇到：

- 气泡换行。
- 多条连续短消息。
- 滚动造成重复。
- DPI 缩放。
- 窗口缩放。
- 浅色 / 深色主题。

因此 OCR 方案必须同时保留：

- BoundingBox。
- 行合并规则。
- 左右区域规则。
- Snapshot 去重。

### 风险 3：模型过度脑补

处理：

- 强制输出多个竞争解释。
- 使用 `confidence`。
- Prompt 明确禁止人格 / 经历推测。
- 权重定义为解释之间相对权重。
- 信息不足时允许低置信度。

### 风险 4：Overlay 遮挡原生聊天

处理：

- 卡片宽度限制。
- 默认靠消息侧边显示。
- 支持折叠。
- 可选鼠标穿透。
- 后续增加 Insight View。

---

## 21. 最终技术决策

V0.1 固定如下：

```text
项目：
ChatInsight

平台：
Windows

技术：
.NET 8
WPF
Windows UI Automation
Windows Graphics Capture
OCR fallback
LLM API

核心架构：
IChatAdapter
      ↓
Capture
      ↓
Message Tracker
      ↓
Conversation Buffer
      ↓
LLM Analyzer
      ↓
Analysis Cache
      ↓
Overlay

首发：
微信 PC
单聊
纯文字
当前会话

分析：
每条对方消息独立分析
最近 8~12 条作为上下文
2~3 个候选隐含解释
相对权重
一句话总结

明确不做：
自动回复
自动发送
长期画像
长期记忆
群聊
图片 / 语音
DLL 注入
Hook
数据库逆向
```

---

## 22. 下一步

开发工作的第一任务不是创建完整应用，而是：

> **P0：微信 UI Automation Capture POC**

先验证：

1. 当前微信 PC 版本是否暴露消息文本。
2. 是否能稳定获取消息 Bounds。
3. 是否能区分左右消息。
4. 是否能识别当前会话。
5. UI 变化事件是否足以触发增量读取。

P0 的结果将直接决定 V0.1 使用：

- UI Automation 主路线；或
- Windows Graphics Capture + OCR 主路线。
