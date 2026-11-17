using AiDocumentWriter.Models;

namespace AiDocumentWriter.Services;

/// <summary>
/// Candidate revisions never overwrite the stored draft. For selected edits,
/// the prefix and suffix are composed by trusted code, not rewritten by an LLM.
/// </summary>
public sealed class WritingRevisionService(DeepSeekClient client)
{
    public async Task<RevisionResult> ReviseAsync(RevisionRequest request, CancellationToken ct)
    {
        if (request.Chat is null) throw new ArgumentException("模型配置不能为空");
        if (string.IsNullOrWhiteSpace(request.CurrentText) || request.CurrentText.Length > 70_000)
            throw new ArgumentException("请提供 1–70000 字符的当前稿件");
        if (string.IsNullOrWhiteSpace(request.Instruction) || request.Instruction.Length > 2500)
            throw new ArgumentException("修改要求不能为空，最多 2500 字符");
        if (request.FactContext?.Length > 18_000 || request.ProtectedTerms?.Length > 4_000)
            throw new ArgumentException("参考事实或保护项过长");

        var isSelection = request.Scope == "selection";
        if (!isSelection && request.Scope != "full")
            throw new ArgumentException("只能选择全文或选中段落修订");

        var start = isSelection ? request.SelectionStart ?? -1 : 0;
        var end = isSelection ? request.SelectionEnd ?? -1 : request.CurrentText.Length;
        if (start < 0 || end <= start || end > request.CurrentText.Length)
            throw new ArgumentException("选中范围无效，请重新选择文本");
        var current = request.CurrentText;
        var selected = current[start..end];
        var contextStart = Math.Max(0, start - 500);
        var contextEnd = Math.Min(current.Length, end + 500);
        var surrounding = isSelection
            ? $"【选中段落之前】\n{current[contextStart..start]}\n【选中段落之后】\n{current[end..contextEnd]}"
            : "";

        var system = """
            你是中文文档的定向修订编辑。只满足用户此轮提出的修改意见。
            所有事实依据来自提供的稿件与事实材料，不允许扩写出不存在的业绩、数值、主体与原因。
            如果要求局部修改，只输出选中文本的替换内容；如果要求全文修改，只输出全文。
            不解释修改过程，不使用代码围栏，不添加“以下是修订后文稿”等包装文字。
            """;
        var user = string.Join("\n\n", [
            "【修改范围】", isSelection ? "局部选中文本" : "全文",
            "【用户的修改意见】", request.Instruction.Trim(),
            "【本轮需要修改的文字】", selected,
            "【周边上下文，仅供衔接，不可改动】", surrounding,
            "【可作为事实依据的材料（不得照搬其中无关内容）】",
                string.IsNullOrWhiteSpace(request.FactContext) ? "无额外材料" : request.FactContext,
            "【必须原样保留的内容】",
                string.IsNullOrWhiteSpace(request.ProtectedTerms) ? "当前稿件中的业务专有名词与原有事实" : request.ProtectedTerms
        ]);
        var chat = request.Chat with
        {
            SystemPrompt = system,
            UserPrompt = user,
            JsonMode = false,
            WritingSkillId = "revise-targeted",
            EnhancementSkillId = request.ImproveStyle ? "improve-style" : null
        };
        var response = await client.ChatAsync(chat, ct);
        var replacement = response.Content.Trim();
        if (string.IsNullOrWhiteSpace(replacement)) throw new InvalidOperationException("模型没有返回修改内容");
        var candidate = isSelection
            ? string.Concat(current.AsSpan(0, start), replacement, current.AsSpan(end))
            : replacement;

        var protectedItems = (request.ProtectedTerms ?? "")
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var term in protectedItems.Where(t => t.Length > 0 && current.Contains(t, StringComparison.Ordinal)))
            if (!candidate.Contains(term, StringComparison.Ordinal))
                throw new ArgumentException($"修订结果导致保护项丢失：{term}。请调整要求或局部修订");

        return new RevisionResult(candidate, current, request.Scope, selected, replacement, response.Usage);
    }
}
