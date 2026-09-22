# ChatInsight：QQ / 微信实时会话注解工具需求与架构方案

> 版本：V0.2（QQ-first 架构修订稿）  
> 目标平台：Windows  
> 首发客户端：QQ NT  
> 后续适配：微信 PC  
> 当前核心原则：**NapCat 提供结构化消息数据，UI Automation 只负责当前 QQ 窗口与消息气泡位置。**

---

## 1. 项目定位

ChatInsight 是一个 Windows 桌面端实时会话注解工具。

它不负责自动回复，也不自动发送消息。核心目标是：

> 读取当前聊天会话上下文，对每一条“对方消息”生成简短的隐含情绪 / 语义解读，并把分析结果以类似聊天旁白的灰色卡片展示在对应消息附近。

示例：

~~~text
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
~~~

下一条消息：

~~~text
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
~~~

其中百分比定义为：

> 模型对若干候选解释的相对权重，不代表对方真实心理状态存在可客观测量的对应概率。

---

## 2. V0.1 / MVP 需求冻结

| 项目 | 定义 |
|---|---|
| 支持平台 | Windows |
| 首发客户端 | QQ NT |
| 后续客户端 | 微信 PC |
| 分析对象 | 当前单聊中的“对方消息” |
| 分析粒度 | 一条聊天消息，不按句号切句 |
| 上下文 | 当前消息之前最近 8～12 条 |
| 分析时机 | 收到新的对方消息后自动分析 |
| 展示形式 | 消息附近的灰色 AI 注解卡片 |
| 输出内容 | 2～3 种解释 + 相对权重 + 一句话总结 |
| 自己消息 | 进入上下文，但不生成分析卡片 |
| 历史回溯 | 第一版不根据后续消息重算旧分析 |
| 长期记忆 | 不做 |
| 联系人画像 | 不做 |
| 自动回复 | 不做 |
| 自动发送 | 不做 |
| 图片 / 语音语义 | 第一版不做 |
| 群聊分析 | 第一版不做 |
| 数据保存 | 默认仅进程内存 |
| AI | 云模型优先，Provider 可替换 |

---

## 3. 产品核心行为

QQ 版运行逻辑：

~~~text
QQ NT
  │
  ├─ NapCat / OneBot
  │      ↓
  │   实时收到结构化消息
  │      ↓
  │   区分 message / message_sent
  │
  └─ Windows UI Automation
         ↓
      读取当前可见消息气泡
         ↓
      获取文本 + BoundingRectangle

两条数据流
    ↓
消息标准化 + 气泡匹配
    ↓
ConversationStore
    ↓
若是自己消息：
    只进入上下文
    ↓
若是对方消息：
    取最近 8～12 条
    ↓
LLM 分析
    ↓
2～3 个解释 + 权重 + 总结
    ↓
Overlay 显示在对应消息旁边
~~~

原则：

1. 每条对方消息最多分析一次。
2. 当前消息可以使用此前短上下文。
3. 自己消息只参与上下文，不生成卡片。
4. 第一版不回溯修改旧分析。
5. 不把模型推断写成确定事实。
6. **消息内容与消息身份以 NapCat 为准，UIA 不再承担主消息采集职责。**
7. **UIA 失败只影响“精确锚定显示”，不影响实时消息接收和 AI 分析。**

---

## 4. 架构决策：QQ-first 双通道

原始方案把 UIA / OCR 同时用于“读取消息”和“定位气泡”。经过现有成熟项目调研后，QQ 版调整为双通道。

### 4.1 数据通道

由 NapCatQQ / OneBot 提供：

- 实时接收消息。
- 自己发送消息事件。
- message_id。
- message_seq。
- time。
- user_id。
- message_type。
- sender。
- message segments。
- raw_message。
- private / group 类型。

数据通道回答：

> **发生了什么？谁发的？内容是什么？属于哪个会话？**

### 4.2 视觉通道

由 Windows UI Automation 提供：

- 当前 QQ 窗口。
- 当前聊天区域。
- 当前可见消息 Item。
- 消息气泡文字。
- 消息 UI 顺序。
- BoundingRectangle。
- QQ 窗口移动 / 最小化 / 滚动状态。

视觉通道回答：

> **这条消息现在画在哪里？**

### 4.3 合并

~~~text
NapCat Message
     │
     │ NativeMessageId / Text / Direction / Time
     │
     ▼
MessageAnchorMatcher
     ▲
     │ Text / Side / VisualIndex / Bounds
     │
UIA VisibleBubble
~~~

匹配成功：

~~~text
ChatMessage
+
VisibleBubble
+
MessageAnalysis
        ↓
MessageAnchor
        ↓
Overlay
~~~

匹配失败：

~~~text
ChatMessage
+
MessageAnalysis
        ↓
侧边 Insight View / 等待重新匹配
~~~

不需要为了坐标失败而重新 OCR 消息正文。

---

## 5. 总体架构

~~~text
                         ┌──────────────┐
                         │    NTQQ      │
                         └──────┬───────┘
                                │
                         NapCatQQ / OneBot
                                │
                       WebSocket Message Event
                                │
                                ▼
┌────────────────────────────────────────────────┐
│                 ChatInsight                    │
│                                                │
│  ┌──────────────── 数据通道 ────────────────┐ │
│  │ QQEventSource                            │ │
│  │      ↓                                   │ │
│  │ OneBotNormalizer                        │ │
│  │      ↓                                   │ │
│  │ ConversationStore                       │ │
│  │      ↓                                   │ │
│  │ InsightAnalyzer                         │ │
│  │      ↓                                   │ │
│  │ MessageAnalysis                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────── 视觉通道 ────────────────┐ │
│  │ QQWindowProbe                           │ │
│  │      ↓                                   │ │
│  │ Windows UI Automation                   │ │
│  │      ↓                                   │ │
│  │ VisibleBubble[]                         │ │
│  └──────────────────────────────────────────┘ │
│                     │                          │
│                     ▼                          │
│             MessageAnchorMatcher               │
│                     │                          │
│                     ▼                          │
│                OverlayHost                     │
└────────────────────────────────────────────────┘
~~~

---

## 6. 为什么不直接依赖 UIA 读取 QQ 消息

成熟项目已经证明 QQ NT 的 UIA 是可用的，但它仍然存在以下天然问题：

- 只看到当前已渲染 / 已加载内容。
- Electron / Chromium Accessibility Tree 受启动状态影响。
- QQ 更新后 Selector 可能改变。
- 同一句“哈哈”可能连续出现多次，单靠 UI 文本不适合作为稳定消息 ID。
- UIA 的本职更适合作为“视图定位”而不是“消息总线”。

NapCat 已经提供结构化事件，因此没有必要再通过 UIA 重建：

- 谁发送。
- 消息 ID。
- 时间戳。
- 消息顺序。
- 当前消息属于哪个用户。
- 自己是否发送。

因此 QQ 版中：

> **NapCat 是消息真相源，UIA 是视觉定位源。**

---

## 7. 成熟项目调研与复用策略

### 7.1 NapCatQQ

项目：

- https://github.com/NapNeko/NapCatQQ

吸收：

- OneBot 11 消息事件模型。
- message 与 message_sent 区分。
- message_id / message_seq。
- 消息段模型。
- WebSocket Server。
- Token 鉴权。
- Heartbeat。
- Protocol Adapter 分层思想。

不复刻：

- NTQQ 协议底层。
- NapCat 内部插件框架。
- 发送 API。
- Bot 管理 UI。

ChatInsight 只把 NapCat 当作可替换外部消息源。

### 7.2 QQ Chat Exporter

项目：

- https://github.com/shuakami/qq-chat-exporter

吸收：

- Raw Message → Clean Message 的标准化思想。
- 第三方协议模型不得直接污染业务层。
- ChatInfo / Sender / MessageElement / Resource 分层。
- 本地服务边界。
- 消息解析与资源解析分离。

不复刻：

- 整套聊天导出功能。
- Rust 导出服务。
- HTML / Excel / JSON 导出器。
- 历史扫描与任务系统。

### 7.3 QQSafeChat

项目：

- https://github.com/TheD0ubleC/QQSafeChat

吸收：

- QQ NT + UIAutomation 的零注入视觉读取路线。
- Chromium Accessibility Tree 激活方式。
- UI Tree Dump 工具。
- ControlFromPoint。
- BoundingRectangle。
- Selector 配置化。
- MessageList / MessageItem 的启发式查找。
- UIA 失败后的可诊断能力。

不复刻：

- URL 安全扫描。
- 文件扫描。
- Bot 自动回写。
- 自动发送。

### 7.4 Lagrange.Core

项目：

- https://github.com/LagrangeDev/Lagrange.Core

吸收：

- 纯 C# 协议 Adapter 思想。
- 后期替换 NapCat 的可能性。
- .NET 原生事件源方向。

第一版不直接使用。

原因：

- 不应让 ChatInsight 自己承担 QQ 登录、重连、协议兼容和生命周期。
- 第一版优先验证产品链路，不验证 QQ 协议实现。

后续可以增加：

~~~text
IChatEventSource
├─ NapCatOneBotSource
└─ LagrangeEventSource
~~~

上层无感替换。

---

## 8. 推荐项目结构

~~~text
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
│  │   │   ├─ ChatConversation.cs
│  │   │   ├─ MessageAnalysis.cs
│  │   │   ├─ VisibleBubble.cs
│  │   │   └─ MessageAnchor.cs
│  │   │
│  │   ├─ Conversation/
│  │   │   └─ ConversationStore.cs
│  │   │
│  │   └─ Interfaces/
│  │       ├─ IChatEventSource.cs
│  │       ├─ IMessageNormalizer.cs
│  │       ├─ IVisibleBubbleSource.cs
│  │       ├─ IMessageAnchorMatcher.cs
│  │       ├─ IMessageAnalyzer.cs
│  │       └─ ILlmProvider.cs
│  │
│  ├─ ChatInsight.QQ
│  │   ├─ NapCat/
│  │   │   ├─ NapCatOneBotSource.cs
│  │   │   ├─ OneBotEventDto.cs
│  │   │   └─ OneBotNormalizer.cs
│  │   │
│  │   └─ UIAutomation/
│  │       ├─ QQWindowProbe.cs
│  │       ├─ QQVisibleBubbleSource.cs
│  │       ├─ QQSelectorProfile.cs
│  │       └─ QQTreeDumper.cs
│  │
│  ├─ ChatInsight.Analysis
│  │   ├─ LlmMessageAnalyzer.cs
│  │   ├─ PromptBuilder.cs
│  │   └─ Providers/
│  │       ├─ OpenAIProvider.cs
│  │       └─ DeepSeekProvider.cs
│  │
│  └─ ChatInsight.Overlay
│      ├─ OverlayManager.cs
│      ├─ MessageAnchorMatcher.cs
│      └─ AnalysisCard.xaml
│
└─ tests/
   ├─ Core.Tests/
   ├─ QQ.Tests/
   └─ Analysis.Tests/
~~~

实际 MVP 可以先只建：

~~~text
ChatInsight.App
ChatInsight.Core
ChatInsight.QQ
ChatInsight.Analysis
~~~

Overlay 代码前期可以暂时留在 App 内，等 UI 稳定后再拆。

---

## 9. 核心消息模型

第三方 OneBot DTO 不进入业务层。

### 9.1 ChatMessage

~~~csharp
public sealed record ChatMessage
{
    public required string Platform { get; init; }

    public required string ConversationId { get; init; }

    public required string NativeMessageId { get; init; }

    public required MessageDirection Direction { get; init; }

    public required DateTimeOffset Timestamp { get; init; }

    public required string Text { get; init; }

    public string? SenderId { get; init; }

    public string? SenderName { get; init; }

    public IReadOnlyList<MessageSegment> Segments { get; init; }
        = [];
}

public enum MessageDirection
{
    Incoming,
    Outgoing
}
~~~

### 9.2 QQ ConversationId

私聊：

~~~text
qq:private:{peerUserId}
~~~

后续群聊：

~~~text
qq:group:{groupId}
~~~

业务层不直接用 QQ 昵称当唯一键。

### 9.3 NativeMessageId

优先使用 NapCat：

~~~text
message_id
~~~

必要时组合：

~~~text
message_id + message_seq
~~~

不要使用：

~~~text
SHA256(Text)
~~~

作为消息唯一 ID。

---

## 10. NapCat / OneBot 数据通道

### 10.1 IChatEventSource

~~~csharp
public interface IChatEventSource
{
    event EventHandler<RawChatEvent> EventReceived;

    Task StartAsync(CancellationToken cancellationToken);

    Task StopAsync();
}
~~~

第一版：

~~~text
IChatEventSource
└─ NapCatOneBotSource
~~~

后续：

~~~text
IChatEventSource
├─ NapCatOneBotSource
├─ LagrangeEventSource
├─ WeChatEventSource
└─ MockChatEventSource
~~~

### 10.2 连接方式

NapCat 开启本地 OneBot WebSocket Server。

推荐：

~~~text
Host: 127.0.0.1
Token: 必须配置
公网监听: 禁止
~~~

ChatInsight 使用 ClientWebSocket 连接。

### 10.3 事件处理

只处理 MVP 需要的：

~~~text
post_type = message
post_type = message_sent
message_type = private
~~~

其中：

~~~text
message
→ Direction.Incoming

message_sent
→ Direction.Outgoing
~~~

其它事件：

- notice
- request
- meta_event
- group

第一版忽略或只记录技术日志。

### 10.4 心跳与断线

NapCat 本身提供 heartbeat。

ChatInsight 需要：

- 连接状态。
- 最后一次 heartbeat 时间。
- 断线重连。
- 指数退避。
- Token 错误明确报错。
- NapCat 未启动明确报错。

NapCat 断线不能导致 App 崩溃。

---

## 11. OneBotNormalizer

职责：

~~~text
OneBot Event DTO
       ↓
过滤 MVP 不支持类型
       ↓
提取 message / message_sent
       ↓
提取纯文本消息段
       ↓
生成 ChatMessage
~~~

示例：

~~~json
{
  "post_type": "message",
  "message_type": "private",
  "message_id": 12345,
  "message_seq": 789,
  "user_id": 654321,
  "time": 1780000000,
  "sender": {
    "nickname": "Jev"
  },
  "message": [
    {
      "type": "text",
      "data": {
        "text": "你最好是"
      }
    }
  ]
}
~~~

标准化：

~~~text
Platform = qq
ConversationId = qq:private:654321
NativeMessageId = 12345
Direction = Incoming
Text = 你最好是
SenderId = 654321
SenderName = Jev
~~~

图片、文件、语音：

第一版只保留占位 Segment，不送入情绪文本分析：

~~~text
[图片]
[语音]
[文件]
~~~

避免媒体消息完全丢失导致上下文顺序错乱。

---

## 12. ConversationStore

ConversationStore 只维护短期运行状态。

结构：

~~~text
ConversationStore
├─ qq:private:10001
│   ├─ M101
│   ├─ M102
│   └─ M103
│
└─ qq:private:10002
    ├─ M201
    └─ M202
~~~

分析目标消息时：

~~~text
Context:
最近 8～12 条

Target:
当前 Incoming Message
~~~

不发送完整历史聊天。

第一版：

- 内存保存。
- 不落 SQLite。
- 应用关闭即清理。
- 已分析 MessageId 可以在运行期缓存。

---

## 13. QQ UI Automation 视觉通道

### 13.1 UIA 只负责视觉信息

QQ UIA 层只输出：

~~~csharp
public sealed record VisibleBubble
{
    public required string Text { get; init; }

    public required Rect Bounds { get; init; }

    public required int VisualIndex { get; init; }

    public BubbleSide Side { get; init; }

    public string? UiRuntimeId { get; init; }
}
~~~

它不决定：

- 消息真实 ID。
- 发送时间。
- ConversationId。
- 是否为新消息。
- 是否已经分析。

这些全部来自数据通道。

### 13.2 Chromium Accessibility

QQ NT 基于 Electron / Chromium。

必要时可：

~~~text
Win + Ctrl + Enter
先启动 Windows 讲述人
↓
再启动 QQ
~~~

或测试：

~~~powershell
QQ.exe --force-renderer-accessibility
~~~

目标是让 QQ 暴露完整 Accessibility Tree。

这属于开发 / 兼容性验证步骤，不应在业务层硬编码为唯一方案。

### 13.3 Tree Dump

需要内置开发工具：

~~~text
chatinsight probe qq
chatinsight dump-uia
~~~

至少输出：

- ControlType
- Name
- Value
- AutomationId
- ClassName
- BoundingRectangle
- RuntimeId（若可用）

QQ 更新后先重新 Dump Tree，不要直接改业务代码。

---

## 14. Selector 配置化

不要把：

~~~text
AutomationId = ml-root
ControlType = Group
~~~

散落写死在代码里。

定义：

~~~json
{
  "messageList": {
    "automationId": "ml-root"
  },
  "messageItem": {
    "controlType": "Group",
    "automationIdRegex": "^\\d+$"
  }
}
~~~

允许不同 QQ 版本维护多个 Profile：

~~~text
selectors/
├─ ntqq-default.json
├─ ntqq-9.x.json
└─ local.override.json
~~~

Selector 查找策略：

~~~text
精确 Selector
    ↓失败
启发式查找
    ↓失败
返回视觉定位不可用
~~~

不要因为 UIA 定位失败而阻塞 NapCat 消息分析。

---

## 15. MessageAnchorMatcher

这是 ChatInsight QQ 版需要自己实现的核心模块之一。

目标：

~~~text
NapCat:
M101 对方 你今天干嘛去了
M102 自己 出去买东西了
M103 对方 哦

UIA:
Bubble A 你今天干嘛去了 Rect(...)
Bubble B 出去买东西了   Rect(...)
Bubble C 哦             Rect(...)

↓

M101 ↔ Bubble A
M102 ↔ Bubble B
M103 ↔ Bubble C
~~~

接口：

~~~csharp
public interface IMessageAnchorMatcher
{
    IReadOnlyList<MessageAnchor> Match(
        IReadOnlyList<ChatMessage> messages,
        IReadOnlyList<VisibleBubble> bubbles);
}
~~~

匹配依据不能只用 Text。

建议考虑：

~~~text
文本完全一致            高
Direction ↔ 左右位置     高
消息时间顺序            高
VisualIndex 顺序         高
临近已匹配消息           中
RuntimeId                辅助
~~~

典型重复文本：

~~~text
哈哈
哈哈
哈哈
~~~

必须依靠：

- 消息序列顺序。
- UI 顺序。
- 方向。
- 相邻匹配关系。

解决。

### 15.1 匹配失败处理

禁止：

~~~text
匹配失败
↓
随便绑定最近的气泡
~~~

应该：

~~~text
匹配置信度不足
↓
不绘制该消息的精确 Overlay
↓
分析结果保留
↓
等待 UI 刷新重新匹配
~~~

必要时降级到 Insight View。

---

## 16. AI 分析层

接口：

~~~csharp
public interface IMessageAnalyzer
{
    Task<MessageAnalysis> AnalyzeAsync(
        IReadOnlyList<ChatMessage> context,
        ChatMessage target,
        CancellationToken cancellationToken);
}
~~~

内部：

~~~text
IMessageAnalyzer
       ↓
LlmMessageAnalyzer
       ↓
ILlmProvider
├─ OpenAIProvider
├─ DeepSeekProvider
└─ LocalProvider（后续）
~~~

AI 层不依赖：

- QQ。
- NapCat。
- OneBot。
- UI Automation。
- WPF。

---

## 17. MessageAnalysis

~~~csharp
public sealed record MessageAnalysis
{
    public required string MessageId { get; init; }

    public required string Title { get; init; }

    public required IReadOnlyList<Interpretation> Interpretations { get; init; }

    public required string Summary { get; init; }

    public required AnalysisConfidence Confidence { get; init; }
}

public sealed record Interpretation
{
    public required string Label { get; init; }

    public required int Weight { get; init; }
}
~~~

示例：

~~~json
{
  "messageId": "12345",
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
~~~

---

## 18. Prompt 约束

Prompt 不问：

> 她真正怎么想？

而问：

> 基于当前目标消息和此前上下文，有哪些合理的隐含语气 / 情绪解释？

基础规则：

~~~text
你是即时通讯语境分析器。

根据目标消息以及目标消息之前的对话上下文，
分析目标消息可能存在的语气、隐含情绪和隐含含义。

要求：

1. 只分析目标消息。
2. 上下文仅作为解释依据。
3. 输出 2~3 个合理解释。
4. 权重之和必须为 100。
5. 权重是候选解释之间的相对权重，不是真实心理概率。
6. 信息不足时降低 confidence。
7. 不虚构对方经历、人格、心理疾病或明确动机。
8. 不生成回复建议。
9. 总结保持一句话。
10. 输出严格 JSON。
~~~

第一版的 AI 目标是：

> **短、快、像聊天旁白。**

不是做长期心理分析。

---

## 19. Overlay

### 19.1 精确锚定模式

当 MessageAnchor 匹配成功：

~~~text
对方：你最好是。      ┌──────────────┐
                      │ 半信半疑 55% │
                      │ 轻微不满 30% │
                      │ 单纯玩笑 15% │
                      └──────────────┘
~~~

WPF：

~~~text
WindowStyle=None
AllowsTransparency=True
Topmost=True
ShowInTaskbar=False
~~~

Win32 行为：

- 不抢 QQ 焦点。
- 可选鼠标穿透。
- QQ 移动时同步。
- QQ 最小化时隐藏。
- QQ 切换会话时更新。
- QQ 滚动时重新 Anchor。

### 19.2 UIA 不可用时的降级

由于消息本身仍来自 NapCat，UIA 失败时不需要 OCR。

降级：

~~~text
QQ                    ChatInsight
┌──────────────┐     ┌────────────────┐
│ 对方：xxxxx  │     │ xxxxx          │
│ 我：xxxx     │     │ AI：xxxx       │
│ 对方：xxx    │     │                │
│              │     │ xxx            │
│              │     │ AI：xxxxx      │
└──────────────┘     └────────────────┘
~~~

这称为：

> Insight View

因此 QQ 第一版的兼容性策略：

~~~text
NapCat 正常 + UIA 正常
→ 精确气泡 Overlay

NapCat 正常 + UIA 失败
→ Insight View

NapCat 失败
→ 无实时消息数据，显示连接错误
~~~

### 19.3 OCR 定位

QQ MVP 不把 OCR 作为主依赖。

后续如果存在某些 QQ 版本完全没有可用 UIA Tree，可再评估：

~~~text
Screenshot
↓
只用于 Bubble Bounds 辅助定位
~~~

但不是用于重建完整消息数据。

---

## 20. 完整运行流程

~~~text
NapCat WebSocket
       ↓
收到 OneBot Event
       ↓
OneBotNormalizer
       ↓
ChatMessage
       ↓
ConversationStore
       ↓
Direction == Incoming ?
       │
       ├─ No
       │   ↓
       │ 加入上下文
       │
       └─ Yes
           ↓
最近 8~12 条上下文
           ↓
InsightAnalyzer
           ↓
MessageAnalysis
           ↓
AnalysisCache
           │
           ├──────────────┐
           │              │
           ▼              │
     QQWindowProbe        │
           ↓              │
       UIAutomation       │
           ↓              │
     VisibleBubble[]      │
           │              │
           └──────┬───────┘
                  ▼
         MessageAnchorMatcher
                  ↓
          匹配是否成功？
            │           │
           Yes          No
            │           │
            ▼           ▼
        Overlay      Insight View
~~~

---

## 21. 消息去重

QQ 数据通道不再依赖 UI 文本去重。

优先：

~~~text
NativeMessageId
~~~

其次：

~~~text
message_id + message_seq
~~~

运行期维护：

~~~text
ProcessedMessageIds
~~~

避免：

- WebSocket 重连后重复事件。
- NapCat 重发。
- UIA 重扫。
- QQ 上滚历史。

UIA Bubble 可以重复扫描，因为它不触发 LLM。

---

## 22. 隐私与日志

默认：

~~~text
NapCat 结构化消息
    ↓
ChatInsight 内存
    ↓
仅截取最近 N 条
    ↓
发送给用户配置的 LLM
    ↓
分析结果保存在内存
~~~

普通日志：

~~~text
MessageReceived
MessageId=12345
Direction=Incoming
Analyze=Success
Latency=1230ms
Anchor=Matched
~~~

默认禁止：

~~~text
Text=你最好是
~~~

配置：

~~~text
EnableSensitiveLogging=false
~~~

NapCat：

- 仅监听 127.0.0.1。
- 必须设置 Token。
- Token 不写入普通日志。
- API Key 不提交 Git。
- 聊天内容不写普通日志。

---

## 23. V0.1 明确做 / 不做

### 做

- Windows。
- QQ NT。
- QQ 单聊。
- 纯文字主分析。
- NapCat / OneBot WebSocket。
- message + message_sent。
- 当前运行期短上下文。
- 每条对方消息独立分析。
- 最近 8～12 条上下文。
- 2～3 个候选解释。
- 相对权重。
- 一句话总结。
- QQ UIA Bubble 定位。
- 灰色 Overlay。
- UIA 失败时 Insight View。
- 云端 LLM Provider。

### 不做

- 自动回复。
- 自动发送。
- QQ 群聊。
- 图片内容理解。
- 语音转文字。
- 表情包视觉分析。
- 长期人格画像。
- 长期关系趋势。
- 联系人长期记忆。
- 整库聊天上传。
- NapCat 内部协议重写。
- DLL 注入。
- QQ 内存 Hook。
- QQ 数据库逆向。
- OCR 作为 QQ 主消息读取方式。

---

## 24. POC 与实施顺序

### P0：NapCat 数据链路 POC

目标：

~~~text
QQ
↓
NapCat
↓
OneBot WebSocket
↓
.NET Console
~~~

验证：

1. ChatInsight 能连接本地 NapCat。
2. 对方发一条私聊，Console 立即收到 message。
3. 自己在原生 QQ 窗口发送消息，Console 收到 message_sent。
4. message_id 稳定存在。
5. message_seq 可用。
6. user_id / target_id 足以建立 ConversationId。
7. 纯文本 Segment 可稳定提取。
8. 连续 20 条消息顺序正确。
9. 断线后可以恢复。

这是第一优先级 POC。

### P1：Conversation POC

实现：

~~~text
OneBot Event
↓
OneBotNormalizer
↓
ChatMessage
↓
ConversationStore
~~~

验证：

- Incoming / Outgoing 顺序正确。
- 不同联系人上下文隔离。
- 最近 8～12 条窗口正确。
- 自己消息不触发分析。
- Incoming 同一个 MessageId 不重复分析。

### P2：Analyzer POC

使用真实 ConversationStore 输出：

~~~text
Context + Target
↓
LLM
↓
严格 JSON
↓
MessageAnalysis
~~~

验证：

- 2～3 个解释。
- 权重和 100。
- 一句话总结。
- Low / Medium / High Confidence。
- 模型超时处理。
- JSON 解析失败重试。
- 不生成回复建议。

### P3：QQ UIA Probe

目标：

~~~text
QQ Window
↓
UI Automation
↓
Current Chat Message List
↓
VisibleBubble[]
~~~

输出至少：

~~~text
Index=0
Text=你今天是不是忘了？
Side=Left
Rect=(320,242,561,288)

Index=1
Text=没有啊
Side=Right
Rect=(721,321,810,365)
~~~

同时实现：

~~~text
dump-uia
~~~

用于 QQ 更新后的诊断。

### P4：MessageAnchorMatcher

准备：

~~~text
ChatMessage[]
+
VisibleBubble[]
~~~

验证：

- 普通消息正确匹配。
- 重复“哈哈”正确匹配。
- 多条连续消息正确匹配。
- 自己 / 对方方向正确。
- 滚动后重新匹配。
- 置信度不足不乱绑。

### P5：Overlay

实现：

- WPF 透明窗。
- 不抢焦点。
- MessageAnchor → Card。
- QQ 移动同步。
- QQ 滚动同步。
- QQ 最小化隐藏。
- 当前会话切换刷新。
- 匹配失败自动降级 Insight View。

### P6：微信 Adapter

QQ MVP 稳定后再研究微信：

~~~text
IChatEventSource
IVisibleBubbleSource
~~~

各新增微信实现。

不修改：

- ConversationStore。
- InsightAnalyzer。
- MessageAnalysis。
- OverlayHost。

---

## 25. MVP 验收标准

QQ V0.1 满足以下条件即完成：

1. 启动后能检测 NapCat 是否可连接。
2. NapCat Token 错误能明确提示。
3. 对方 QQ 私聊消息能够实时进入 ChatInsight。
4. 自己从原生 QQ 客户端发送的消息能够进入 ChatInsight。
5. 两类消息能正确区分 Incoming / Outgoing。
6. 不同联系人 ConversationId 正确隔离。
7. 最近 8～12 条上下文顺序正确。
8. 自己消息不触发 AI。
9. 对方新消息在 1～3 秒内得到分析结果。
10. 同一 NativeMessageId 不重复分析。
11. UIA 可读取当前 QQ 聊天气泡文字。
12. UIA 可读取 Bubble BoundingRectangle。
13. 普通文本消息能正确完成 Message ↔ Bubble 匹配。
14. 连续重复文本不会明显错绑。
15. 匹配失败时不显示错误位置的卡片。
16. QQ 移动后 Overlay 能重新定位。
17. QQ 滚动后 Overlay 能重新定位。
18. QQ 最小化时 Overlay 隐藏。
19. UIA 失败时 AI 分析仍能正常工作，并降级 Insight View。
20. NapCat 断线时 App 不崩溃。
21. LLM 超时 / API 失败时 App 不崩溃。
22. 默认日志不记录聊天原文。
23. 不具备任何自动发送能力。

---

## 26. 风险与处理

### 风险 1：NapCat 兼容 / 登录风险

处理：

- 将 NapCat 视为独立外部组件。
- ChatInsight 不绑定其内部实现。
- 通过 IChatEventSource 隔离。
- 第一版仅本地连接。
- 后续可以替换 LagrangeEventSource。

### 风险 2：QQ UIA Tree 变化

处理：

- Selector 配置化。
- Tree Dump 工具。
- 精确查找 + 启发式查找。
- UIA 失败不影响消息分析。
- 降级 Insight View。

### 风险 3：Message ↔ Bubble 错配

处理：

- 不使用单一 Text 匹配。
- 同时使用 Direction / 顺序 / 邻接关系。
- 设置匹配置信度。
- 低置信度不绘制。
- 自动重新尝试匹配。

### 风险 4：模型过度脑补

处理：

- 强制多个竞争解释。
- 权重只表示候选解释之间的相对权重。
- Confidence。
- 信息不足允许低置信度。
- 禁止人格 / 病理 / 明确动机断言。

### 风险 5：Overlay 遮挡 QQ

处理：

- 卡片最大宽高限制。
- 优先显示在气泡空白侧。
- 可折叠。
- 鼠标穿透。
- 可切换 Insight View。

---

## 27. 最终技术决策

~~~text
项目：
ChatInsight

平台：
Windows

首发：
QQ NT
单聊
文字消息

主技术：
.NET 8
WPF
NapCatQQ
OneBot WebSocket
Windows UI Automation
LLM API

数据通道：
QQ
↓
NapCat
↓
OneBot WebSocket
↓
NapCatOneBotSource
↓
OneBotNormalizer
↓
ChatMessage

视觉通道：
QQ Window
↓
UI Automation
↓
VisibleBubble

业务：
ChatMessage
↓
ConversationStore
↓
InsightAnalyzer
↓
MessageAnalysis

视觉合并：
ChatMessage + VisibleBubble
↓
MessageAnchorMatcher
↓
OverlayHost

降级：
UIA 不可用
↓
Insight View

明确不做：
自动回复
自动发送
长期画像
长期记忆
QQ 协议重写
DLL 注入
Hook
数据库逆向
OCR 主消息采集
~~~

---

## 28. 下一步

当前第一任务改为：

> **P0：NapCat → OneBot WebSocket → .NET Console 数据链路验证**

验证顺序：

~~~text
1. 配置 NapCat 本地 WebSocket
2. 设置 Token
3. .NET ClientWebSocket 建立连接
4. 接收对方 message
5. 接收自己 message_sent
6. 打印 message_id / seq / user_id / time / text
7. 连续聊天验证顺序和去重
~~~

P0 成功后再做：

> **P3：QQ UIA Bubble Probe**

开发顺序已经从：

~~~text
先研究 QQ UIA 能不能读消息
~~~

改成：

~~~text
先用 NapCat 把消息流稳定拿到
↓
再用 UIA 解决“气泡坐标”
~~~

这会显著降低项目的首期技术风险。

---

## 29. 当前架构结论

ChatInsight QQ 版不是一个 QQ 自动化框架，也不是一个 Bot。

它应当保持为：

> **结构化消息事件 + 短上下文 AI 解读 + 原生聊天窗口视觉注解层。**

QQ 协议、登录、消息事件由成熟底层项目负责；ChatInsight 自己只实现真正属于产品核心的部分：

~~~text
标准化
上下文
逐条隐含语义分析
消息与气泡匹配
Overlay 可视化
~~~
