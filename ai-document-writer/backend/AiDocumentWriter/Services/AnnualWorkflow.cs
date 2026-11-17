using System.Text.Json;
using AiDocumentWriter.Models;

namespace AiDocumentWriter.Services;

public sealed class AnnualWorkflow(DeepSeekClient llm)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };
    private const int MaxFacts = 250;

    public async Task<AnnualExtractResult> ExtractAsync(AnnualExtractRequest request, CancellationToken ct)
    {
        var doc = request.Document;
        if (string.IsNullOrWhiteSpace(doc.Id) || string.IsNullOrWhiteSpace(doc.FileName)
            || string.IsNullOrWhiteSpace(doc.Content)) throw new ArgumentException("请提供完整文件信息");
        if (doc.Content.Length > 70000) throw new ArgumentException("单篇文档超过 70000 字符，需拆分处理");
        var system = """
            你是企业办公资料的事实提取程序。只能从明确提供的文档中提取事实，禁止补造内容。
            输出严格 JSON 对象，不允许 Markdown 围栏或额外解释。
            字段格式：{"items":[{"title":"事项标题","project":"项目/工作领域，未知则空字符串",
            "period":"文中时间或指定月份","progress":"完成/进行中/计划/不明确",
            "description":"有事实依据的一句话概括","numericEvidence":"指标及统计口径，未知则空字符串",
            "evidence":"从原文逐字复制的证据片段"}]}。
            evidence 必须是原文中连续出现的原样文本，尽量选择可以唯一定位的 10-90 字片段。
            每项事实独立记录。不同月份相似的工作也不能自行合并。
            不得把展望、目标、建议描述为已完成成果。
            若文件只有格式模板没有可确认的工作事项，返回 {"items":[]}。
            """;
        var user = "文件：" + doc.FileName + "\n指定月份：" + (doc.Month ?? "未指定")
            + "\n【正文开始】\n" + doc.Content + "\n【正文结束】";
        var response = await llm.ChatAsync(request.Chat with { SystemPrompt = system, UserPrompt = user, JsonMode = true }, ct);
        var parsed = ParseJson<ExtractEnvelope>(response.Content);
        var result = new List<AnnualFact>();
        foreach (var item in parsed.Items ?? [])
        {
            if (result.Count >= 60) throw new ArgumentException("单篇提取超过 60 项，请拆分文档");
            if (string.IsNullOrWhiteSpace(item.Title) || string.IsNullOrWhiteSpace(item.Evidence)) continue;
            var evidence = item.Evidence.Trim();
            result.Add(new AnnualFact
            {
                Id = doc.Id + "-" + (result.Count + 1),
                Title = Limit(item.Title, 200),
                Project = Limit(item.Project, 200),
                Period = string.IsNullOrWhiteSpace(item.Period) ? doc.Month ?? "" : Limit(item.Period, 80),
                Progress = Limit(item.Progress, 40),
                Description = Limit(item.Description, 1500),
                NumericEvidence = Limit(item.NumericEvidence, 700),
                SourceFile = doc.FileName,
                SourceId = doc.Id,
                Evidence = Limit(evidence, 500),
                EvidenceMatched = doc.Content.Contains(evidence, StringComparison.Ordinal)
            });
        }
        return new AnnualExtractResult(result, result.Count(x => !x.EvidenceMatched), response.Usage);
    }

    public async Task<AnnualMergeResult> MergeAsync(AnnualMergeRequest request, CancellationToken ct)
    {
        if (request.Facts is null || request.Facts.Count == 0) throw new ArgumentException("至少提取一项工作事实");
        if (request.Facts.Count > MaxFacts) throw new ArgumentException("事项过多，最多 250 项");
        if (request.Facts.Any(f => string.IsNullOrWhiteSpace(f.Id) || string.IsNullOrWhiteSpace(f.Title)))
            throw new ArgumentException("工作台账包含无效项");
        if (request.Facts.Select(f => f.Id).Distinct(StringComparer.Ordinal).Count() != request.Facts.Count)
            throw new ArgumentException("工作事项 ID 重复");

        var system = """
            你是工作事项归并分析程序。依据输入事实，判断跨月事项关系，输出严格 JSON 对象。
            JSON 格式：{"groups":[{"title":"组名","kind":"progress|recurring|duplicate|independent",
            "memberIds":["必须完全等于输入中的事实 ID"],"summary":"带进度与来源依据的准确合并描述",
            "metrics":"指标总结（仅在统计口径兼容且互不重复时计算）",
            "conflicts":[{"severity":"critical|normal","description":"明确指出冲突、缺证或统计口径问题"}]}]}。
            进展类：同一项目的不同阶段应汇总过程，不能累加百分比。
            周期类：保留每次独立工作，只有统计口径一致且不重复才能汇总数量。
            重复类：同一成果的重复记录只计算一次。
            独立类：不同项目/不同工作对象不能因名称相似而强行合并。
            发生完成状态、金额、累计量、责任主体等关键冲突，标记 critical。
            无法证实指标能相加时，不得计算合计值，标记 normal 或 critical。
            没有证据就不要添加事实和指标；每个事实 ID 只能归属一组，不能遗漏。
            """;
        var compact = request.Facts.Select(f => new
        {
            f.Id, f.Title, f.Project, f.Period, f.Progress, f.Description,
            f.NumericEvidence, f.SourceFile, f.Evidence, f.EvidenceMatched
        });
        var prompt = "请分析归并以下事实。仅使用 JSON 中列出的事实。\n"
            + JsonSerializer.Serialize(compact, Json) + "\n【写作范围】\n" + (request.Requirement ?? "");
        var response = await llm.ChatAsync(request.Chat with { SystemPrompt = system, UserPrompt = prompt, JsonMode = true }, ct);
        var proposed = ParseJson<MergeEnvelope>(response.Content).Groups ?? [];
        var allowed = request.Facts.ToDictionary(f => f.Id, StringComparer.Ordinal);
        var already = new HashSet<string>(StringComparer.Ordinal);
        var groups = new List<AnnualGroup>();
        var index = 1;
        foreach (var group in proposed)
        {
            var members = (group.MemberIds ?? []).Where(id => allowed.ContainsKey(id) && !already.Contains(id))
                .Distinct(StringComparer.Ordinal).ToList();
            if (members.Count == 0) continue;
            foreach (var id in members) already.Add(id);
            var conflicts = (group.Conflicts ?? []).Where(c => !string.IsNullOrWhiteSpace(c.Description))
                .Select(c => new AnnualConflict
                {
                    Severity = c.Severity == "critical" ? "critical" : "normal",
                    Description = Limit(c.Description, 600), Resolution = "pending"
                }).ToList();
            if (members.Any(id => !allowed[id].EvidenceMatched))
                conflicts.Add(new AnnualConflict
                {
                    Severity = "critical", Description = "提取项的证据无法在原文中精确定位，请核对来源",
                    Resolution = "pending"
                });
            groups.Add(new AnnualGroup
            {
                Id = "G" + index++, Title = Limit(group.Title, 200),
                Kind = group.Kind is "progress" or "recurring" or "duplicate" or "independent" ? group.Kind : "independent",
                MemberIds = members, Summary = Limit(group.Summary, 2500), Metrics = Limit(group.Metrics, 1000),
                Conflicts = conflicts, Included = true
            });
        }
        foreach (var fact in request.Facts.Where(f => !already.Contains(f.Id)))
            groups.Add(new AnnualGroup
            {
                Id = "G" + index++, Title = fact.Title, Kind = "independent",
                MemberIds = [fact.Id], Summary = fact.Description, Metrics = fact.NumericEvidence,
                Included = true, Conflicts = fact.EvidenceMatched ? [] : [new AnnualConflict
                {
                    Severity = "critical", Description = "原文证据未通过核对", Resolution = "pending"
                }]
            });
        return new AnnualMergeResult(groups, response.Usage);
    }

    private static string Limit(string? s, int max) =>
        string.IsNullOrWhiteSpace(s) ? "" : s.Trim()[..Math.Min(s.Trim().Length, max)];

    private static T ParseJson<T>(string text)
    {
        var trimmed = text.Trim();
        var fence = new string((char)96, 3);
        if (trimmed.StartsWith(fence, StringComparison.Ordinal))
        {
            var firstNewLine = trimmed.IndexOf('\n');
            var lastFence = trimmed.LastIndexOf(fence, StringComparison.Ordinal);
            if (firstNewLine >= 0 && lastFence > firstNewLine)
                trimmed = trimmed[(firstNewLine + 1)..lastFence].Trim();
        }
        try { return JsonSerializer.Deserialize<T>(trimmed, Json) ?? throw new ArgumentException("模型返回空 JSON"); }
        catch (JsonException e) { throw new ArgumentException("模型未返回有效结构化数据，请重试该步骤", e); }
    }

    private sealed class ExtractEnvelope { public List<ExtractItem>? Items { get; set; } }
    private sealed class ExtractItem
    {
        public string? Title { get; set; }
        public string? Project { get; set; }
        public string? Period { get; set; }
        public string? Progress { get; set; }
        public string? Description { get; set; }
        public string? NumericEvidence { get; set; }
        public string? Evidence { get; set; }
    }
    private sealed class MergeEnvelope { public List<AnnualGroup>? Groups { get; set; } }
}
