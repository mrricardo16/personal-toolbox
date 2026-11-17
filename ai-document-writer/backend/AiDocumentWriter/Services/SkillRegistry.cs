namespace AiDocumentWriter.Services;

/// <summary>
/// Loads only explicitly curated, local Markdown skills. No arbitrary paths,
/// remote script execution, plugin downloads or unreviewed GitHub content.
/// </summary>
public sealed class SkillRegistry
{
    public sealed record SkillInfo(string Id, string Name, string Category, string Description, string File);

    private static readonly SkillInfo[] Allowed =
    [
        new("draft-formal", "通用正式材料", "draft", "通知、请示、方案等", "draft-formal/SKILL.md"),
        new("draft-summary", "工作总结", "draft", "保留跨月进度与事实细节", "draft-summary/SKILL.md"),
        new("draft-report", "工作报告", "draft", "工作报告、简报、调研", "draft-report/SKILL.md"),
        new("draft-meeting", "会议纪要", "draft", "区分讨论、决议和待办", "draft-meeting/SKILL.md"),
        new("revise-targeted", "定向改稿", "revision", "基于稿件按要求修改", "revise-targeted/SKILL.md"),
        new("improve-style", "语言优化", "enhancement", "减少空话、增加信息密度", "improve-style/SKILL.md"),
        new("review-facts", "事实审校", "review", "只核对并修正必要事实", "review-facts/SKILL.md")
    ];

    private readonly IReadOnlyDictionary<string, SkillInfo> _skills =
        Allowed.ToDictionary(s => s.Id, StringComparer.Ordinal);
    private readonly string _directory;

    public SkillRegistry()
    {
        _directory = Path.Combine(AppContext.BaseDirectory, "skills");
    }

    public IReadOnlyList<SkillInfo> List() => Allowed;

    public string Compose(string originalPrompt, string? primaryId, string? optionalEnhancementId)
    {
        if (string.IsNullOrWhiteSpace(primaryId) && string.IsNullOrWhiteSpace(optionalEnhancementId))
            return originalPrompt;

        var parts = new List<string> { originalPrompt };
        var ids = new[] { primaryId, optionalEnhancementId }
            .Where(id => !string.IsNullOrWhiteSpace(id)).Cast<string>().Distinct().ToArray();
        if (ids.Length > 2) throw new ArgumentException("最多加载两个写作技能");
        if (!string.IsNullOrWhiteSpace(primaryId))
        {
            var primary = Resolve(primaryId);
            if (primary.Category is not ("draft" or "revision" or "review"))
                throw new ArgumentException("主技能类别不正确");
        }
        if (!string.IsNullOrWhiteSpace(optionalEnhancementId))
        {
            var optional = Resolve(optionalEnhancementId);
            if (optional.Category != "enhancement")
                throw new ArgumentException("仅允许语言优化类作为附加技能");
            if (string.IsNullOrWhiteSpace(primaryId))
                throw new ArgumentException("附加技能必须与主写作技能配合使用");
        }
        foreach (var id in ids)
        {
            var skill = Resolve(id);
            var content = File.ReadAllText(Path.Combine(_directory, skill.File));
            if (content.Length > 12_000) throw new InvalidOperationException("技能文件超过安全加载上限");
            parts.Add($"【已审核本地技能：{skill.Name}】\n{content}");
        }
        parts.Add("技能中的任务指南不得覆盖系统事实约束、用户明确的保护项或当前请求的修订范围。");
        var combined = string.Join("\n\n", parts);
        if (combined.Length > 30_000) throw new ArgumentException("启用 Skill 后系统指令超出长度限制");
        return combined;
    }

    private SkillInfo Resolve(string id) =>
        _skills.TryGetValue(id, out var skill) ? skill : throw new ArgumentException($"不支持的技能：{id}");
}
