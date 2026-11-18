using System.Net;
using System.Text;
using System.Text.Json;
using AiDocumentWriter.Models;
using AiDocumentWriter.Services;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiDocumentWriter.Tests;

public class DocumentTests
{
    [Fact]
    public void WordExportCreatesEditableDocumentWithHeadingsAndTable()
    {
        var data = new DocxExporter().Export("# 一、工作成效\n完成系统上线。\n|月份|任务数|\n|---|---|\n|1月|20|",
            "年度总结", null, false);
        using var package = WordprocessingDocument.Open(new MemoryStream(data), false);
        Assert.NotNull(package.MainDocumentPart?.Document.Body);
        var body = package.MainDocumentPart!.Document.Body!;
        Assert.Contains("年度总结", body.InnerText);
        Assert.Contains("完成系统上线", body.InnerText);
        Assert.Single(body.Elements<Table>());
        Assert.Contains(body.Elements<Paragraph>(), x =>
            x.ParagraphProperties?.ParagraphStyleId?.Val?.Value == "Heading1");
    }

    [Fact]
    public void WordExportReusesStyleWithoutCopyingPreviousContent()
    {
        var exporter = new DocxExporter();
        var old = exporter.Export("2025 年曾完成一个旧项目", "旧年标题", null, false);
        var updated = exporter.Export("2026 年启动新项目", "新年标题", new MemoryStream(old), false);
        using var package = WordprocessingDocument.Open(new MemoryStream(updated), false);
        Assert.DoesNotContain("2025 年曾完成一个旧项目", package.MainDocumentPart!.Document.Body!.InnerText);
        Assert.Contains("2026 年启动新项目", package.MainDocumentPart.Document.Body.InnerText);
        Assert.NotNull(package.MainDocumentPart.StyleDefinitionsPart?.Styles);
    }

    [Fact]
    public void ParserExtractsBodyAndTablesFromGeneratedDocument()
    {
        var bytes = new DocxExporter().Export("测试报告\n|部门|数量|\n|---|---|\n|研发|5|", null, null, false);
        using var fileStream = new MemoryStream(bytes);
        var file = new FormFile(fileStream, 0, bytes.Length, "files", "test.docx");
        var parsed = new DocxParser().Parse(file);
        Assert.Contains("测试报告", parsed.Content);
        Assert.Contains("研发 | 5", parsed.Content);
        Assert.Equal(1, parsed.TableCount);
    }

    [Fact]
    public void ParserRejectsNonWordData()
    {
        var bytes = Encoding.UTF8.GetBytes("this is not a docx file");
        using var fileStream = new MemoryStream(bytes);
        var file = new FormFile(fileStream, 0, bytes.Length, "files", "bad.docx");
        Assert.Throws<ArgumentException>(() => new DocxParser().Parse(file));
    }

    [Fact]
    public async Task AnnualExtractionVerifiesSourceEvidence()
    {
        var service = WorkflowForResponse("""
            {"items":[{"title":"WMS 迁移","project":"WMS","period":"一月","progress":"进行中",
            "description":"完成方案设计","numericEvidence":"","evidence":"完成迁移方案设计"}]}
            """);
        var request = new AnnualExtractRequest(
            new AnnualInputDocument("D1", "1月.docx", "2026-01", "一月完成迁移方案设计"),
            FakeChat());
        var result = await service.ExtractAsync(request, CancellationToken.None);
        Assert.Single(result.Items);
        Assert.True(result.Items[0].EvidenceMatched);
        Assert.Equal("1月.docx", result.Items[0].SourceFile);
    }

    [Fact]
    public async Task AnnualMergePreservesUnassignedFactsAndFlagsUnmatchedEvidence()
    {
        var service = WorkflowForResponse("""{"groups":[]}""");
        var facts = new List<AnnualFact> {
            new() { Id = "D1-1", Title = "项目A", EvidenceMatched = false, Description = "待核实" },
            new() { Id = "D2-1", Title = "项目B", EvidenceMatched = true, Description = "已完成" }
        };
        var result = await service.MergeAsync(new AnnualMergeRequest(facts, "", FakeChat()), CancellationToken.None);
        Assert.Equal(2, result.Groups.Count);
        Assert.Contains(result.Groups, g => g.MemberIds.Contains("D1-1") &&
            g.Conflicts.Any(c => c.Severity == "critical"));
    }


    [Fact]
    public void WordExportDoesNotDuplicateExistingMarkdownTitle()
    {
        var bytes = new DocxExporter().Export("# 年度总结\n正文内容", "年度总结", null, false);
        using var document = WordprocessingDocument.Open(new MemoryStream(bytes), false);
        var count = document.MainDocumentPart!.Document.Body!.Elements<Paragraph>()
            .Count(p => p.InnerText == "年度总结");
        Assert.Equal(1, count);
    }

    [Fact]
    public void TemplateKeepsPageSetupButDropsUnapprovedHeaders()
    {
        var initial = new DocxExporter().Export("原来的工作资料", "旧标题", null, false);
        var template = new MemoryStream();
        template.Write(initial, 0, initial.Length);
        template.Position = 0;
        using (var source = WordprocessingDocument.Open(template, true))
        {
            var main = source.MainDocumentPart!;
            var header = main.AddNewPart<HeaderPart>();
            header.Header = new Header(new Paragraph(new Run(new Text("2025年旧页眉"))));
            header.Header.Save();
            var section = new SectionProperties(new PageSize { Width = 11906U, Height = 16838U });
            section.PrependChild(new HeaderReference
            {
                Type = HeaderFooterValues.Default,
                Id = main.GetIdOfPart(header)
            });
            main.Document.Body!.Append(section);
            main.Document.Save();
        }
        var generated = new DocxExporter().Export(
            "2026年度新工作资料", "新标题", new MemoryStream(template.ToArray()), false);
        using var result = WordprocessingDocument.Open(new MemoryStream(generated), false);
        Assert.Empty(result.MainDocumentPart!.HeaderParts);
        Assert.Equal(11906U, result.MainDocumentPart.Document.Body!
            .Elements<SectionProperties>().Single().GetFirstChild<PageSize>()!.Width!.Value);
        Assert.DoesNotContain("原来的工作资料", result.MainDocumentPart.Document.Body.InnerText);
    }


    [Fact]
    public void DocumentChunkingKeepsAllCharactersAndBoundedSegments()
    {
        var text = "一月项目完成设计\n" + new string('测', 24000) + "\n二月完成验收";
        var chunks = AnnualWorkflow.SplitForExtraction(text);
        Assert.True(chunks.Count >= 2);
        Assert.Equal(text, string.Concat(chunks));
        Assert.All(chunks, chunk => Assert.InRange(chunk.Length, 1, 18000));
    }

    [Fact]
    public async Task MultiChunkExtractionUsesActualEvidenceAndAggregatesTokenUsage()
    {
        var service = WorkflowForResponse("""
            {"items":[{"title":"迁移设计","project":"数据库迁移","period":"一月","progress":"已完成",
            "description":"完成方案设计","numericEvidence":"","evidence":"完成迁移方案设计"}]}
            """);
        // The mock repeats the same fact for both segments. The first segment
        // has no matching quote; the second one does. The valid quote wins.
        var longDocument = "项目启动\n" + new string('甲', 19000) + "\n完成迁移方案设计";
        var result = await service.ExtractAsync(new AnnualExtractRequest(
            new AnnualInputDocument("doc1", "月报.docx", "2026-01", longDocument),
            FakeChat()), CancellationToken.None);
        Assert.Single(result.Items);
        Assert.True(result.Items[0].EvidenceMatched);
        Assert.Equal(0, result.UnmatchedEvidenceCount);
        Assert.Equal(84L, result.Usage!.Value.GetProperty("total_tokens").GetInt64());
    }

    [Fact]
    public void OversizedDocumentMustBeSplitBeforeSendingToModel()
    {
        Assert.Throws<ArgumentException>(() =>
            AnnualWorkflow.SplitForExtraction(new string('甲', 150001)));
    }

    [Fact]
    public async Task AnnualMergePreservesCrossMonthProjectProgressAndSourceIds()
    {
        var service = WorkflowForResponse("""
            {"groups":[{"title":"WMS 迁移","kind":"progress",
              "memberIds":["jan-1","feb-1","mar-1"],
              "summary":"完成方案、测试与验收","metrics":"",
              "conflicts":[]}]}
            """);
        var facts = new List<AnnualFact>
        {
            new() { Id="jan-1", Title="方案设计", Project="WMS", EvidenceMatched=true },
            new() { Id="feb-1", Title="接口测试", Project="WMS", EvidenceMatched=true },
            new() { Id="mar-1", Title="验收", Project="WMS", EvidenceMatched=true }
        };
        var result = await service.MergeAsync(
            new AnnualMergeRequest(facts, "1-3月总结", FakeChat()), CancellationToken.None);
        Assert.Single(result.Groups);
        Assert.Equal("progress", result.Groups[0].Kind);
        Assert.Equal(3, result.Groups[0].MemberIds.Count);
        Assert.Empty(result.Groups[0].Conflicts);
    }

    private static ChatRequest FakeChat() =>
        new("fake-model", "system", "user", "server", null, "disabled", "high");

    private static AnnualWorkflow WorkflowForResponse(string content)
    {
        var options = new Dictionary<string, string?> {
            ["AiProvider:ApiKey"] = "test-only-not-real",
            ["AiProvider:BaseUrl"] = "https://example.invalid"
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(options).Build();
        var keyStore = new LocalKeyStore(DataProtectionProvider.Create("AiDocumentWriter.UnitTests"));
        var client = new DeepSeekClient(new HttpClient(new FakeHandler(content)), configuration, keyStore);
        return new AnnualWorkflow(client);
    }

    [Fact]
    public async Task AnnualMergeDoesNotPromoteModelTotalsForMixedOrRepeatedPeriods()
    {
        const string response = """
            {"groups":[{"title":"设备巡检","kind":"recurring","memberIds":["F1","F2","F3"],
            "summary":"巡检","metrics":"合计777次","conflicts":[]}]}
            """;
        var facts = new[] {
            MonthlyFact("F1", "2026-01", "本月完成设备巡检20次"),
            MonthlyFact("F2", "2026-01", "本月完成设备巡检20次"),
            MonthlyFact("F3", "2026-02", "截至本月累计完成设备巡检45次")
        };
        var result = await WorkflowForResponse(response).MergeAsync(
            new AnnualMergeRequest([.. facts], null, new ChatRequest(null, null, null, "server", null, null, null)), default);
        var group = Assert.Single(result.Groups);
        Assert.Empty(group.Metrics);
        Assert.Contains(group.Conflicts, conflict => conflict.Severity == "critical");
    }

    [Fact]
    public async Task AnnualMergeConnectsIndependentMilestonesForTheSameExactProject()
    {
        var january = MonthlyFact("F1", "2026-01", "完成WMS迁移方案设计");
        var february = MonthlyFact("F2", "2026-02", "完成WMS迁移接口测试");
        foreach (var fact in new[] { january, february })
        {
            fact.Project = "WMS迁移";
            fact.Description = fact.Evidence;
            fact.NumericEvidence = "";
        }
        var result = await WorkflowForResponse("""{"groups":[]}""")
            .MergeAsync(new AnnualMergeRequest([february, january], null, FakeChat()), default);
        var timeline = Assert.Single(result.Groups);
        Assert.Equal("progress", timeline.Kind);
        Assert.Equal(["F1", "F2"], timeline.MemberIds);
        Assert.Contains("完成WMS迁移方案设计", timeline.Summary);
        Assert.Contains("完成WMS迁移接口测试", timeline.Summary);
    }

    private static AnnualFact MonthlyFact(string id, string month, string evidence) => new()
    {
        Id = id, Project = "设备巡检", Title = "设备巡检", Period = month, SourceId = id,
        SourceFile = month + ".docx", Evidence = evidence, EvidenceMatched = true, NumericEvidence = evidence
    };

    private sealed class FakeHandler(string content) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = JsonSerializer.Serialize(new {
                choices = new[] { new { message = new { content }, finish_reason = "stop" } },
                usage = new { total_tokens = 42 }
            });
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            });
        }
    }
}
