using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AiDocumentWriter.Models;
using AiDocumentWriter.Services;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiDocumentWriter.Tests;

/// <summary>
/// Full HTTP workflow test using six synthetic DOCX reports and a deterministic
/// in-process fake model. No external AI service, API key, or billing is involved.
/// </summary>
[CollectionDefinition("AcceptanceAppHost", DisableParallelization = true)]
public sealed class AcceptanceAppHostCollection { }

[Collection("AcceptanceAppHost")]
public sealed class AcceptanceFlowTests
{
    private static readonly (string Month, string Content)[] Samples =
    [
        ("2026-01", "1月完成迁移方案设计；完成设备巡检20次。"),
        ("2026-02", "2月完成业务接口测试；完成设备巡检25次。"),
        ("2026-03", "3月完成数据库迁移验收；完成设备巡检30次。"),
        ("2026-04", "4月完成设备巡检20次。"),
        ("2026-05", "5月完成设备巡检25次。"),
        ("2026-06", "6月完成设备巡检30次。")
    ];

    [Fact]
    public async Task SixMonthlyDocxReportsFlowThroughParseExtractMergeWriteAndWordExport()
    {
        using var factory = new AcceptanceWebFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Writer-Client", "ai-document-writer");
        using var upload = new MultipartFormDataContent();
        foreach (var sample in Samples)
        {
            var bytes = new DocxExporter().Export(sample.Content, "月度工作报告", null, false);
            upload.Add(new ByteArrayContent(bytes), "files", sample.Month + ".docx");
        }
        using var parsedResponse = await client.PostAsync("/api/documents/parse", upload);
        Assert.Equal(HttpStatusCode.OK, parsedResponse.StatusCode);
        using var parsed = JsonDocument.Parse(await parsedResponse.Content.ReadAsStringAsync());
        var documents = parsed.RootElement.GetProperty("documents");
        Assert.Equal(6, documents.GetArrayLength());
        Assert.All(documents.EnumerateArray(), document =>
        {
            Assert.Contains("巡检", document.GetProperty("content").GetString());
            Assert.True(document.GetProperty("characterCount").GetInt32() > 0);
        });

        var facts = new List<AnnualFact>();
        for (var index = 0; index < documents.GetArrayLength(); index++)
        {
            var item = documents[index];
            var input = new AnnualInputDocument(
                "F" + (index + 1),
                item.GetProperty("fileName").GetString()!,
                Samples[index].Month,
                item.GetProperty("content").GetString()!);
            using var result = await client.PostAsJsonAsync("/api/annual/extract",
                new AnnualExtractRequest(input, FakeChat()));
            Assert.Equal(HttpStatusCode.OK, result.StatusCode);
            var data = await result.Content.ReadFromJsonAsync<AnnualExtractResult>();
            Assert.NotNull(data);
            Assert.Equal(0, data.UnmatchedEvidenceCount);
            Assert.All(data.Items, fact => Assert.True(fact.EvidenceMatched));
            facts.AddRange(data.Items);
        }
        Assert.Equal(9, facts.Count); // 3 WMS milestones + 6 monthly patrol totals
        Assert.Equal(9, facts.Select(f => f.Id).Distinct().Count());

        using var mergedResponse = await client.PostAsJsonAsync("/api/annual/merge",
            new AnnualMergeRequest(facts, "写2026年1-6月工作总结", FakeChat()));
        Assert.Equal(HttpStatusCode.OK, mergedResponse.StatusCode);
        var merged = await mergedResponse.Content.ReadFromJsonAsync<AnnualMergeResult>();
        Assert.NotNull(merged);
        Assert.Equal(2, merged.Groups.Count);
        var progress = Assert.Single(merged.Groups.Where(g => g.Kind == "progress"));
        Assert.Equal(3, progress.MemberIds.Count);
        var recurring = Assert.Single(merged.Groups.Where(g => g.Kind == "recurring"));
        Assert.Equal(6, recurring.MemberIds.Count);
        Assert.Contains("150次", recurring.Metrics);
        Assert.Empty(merged.Groups.SelectMany(g => g.Conflicts));

        var finalPrompt = JsonSerializer.Serialize(merged.Groups);
        using var generatedResponse = await client.PostAsJsonAsync("/api/llm/chat",
            FakeChat() with
            {
                SystemPrompt = "忠实撰写年度总结，不得虚构事实",
                UserPrompt = "使用以下已确认的事实形成总结：" + finalPrompt
            });
        Assert.Equal(HttpStatusCode.OK, generatedResponse.StatusCode);
        var final = await generatedResponse.Content.ReadFromJsonAsync<ChatResult>();
        Assert.NotNull(final);
        Assert.Contains("150次", final.Content);
        Assert.Contains("方案设计", final.Content);

        // Reuse a previous report as a formatting template. Its old body
        // must not be copied into the new Word document.
        var templateBytes = new DocxExporter().Export(
            "往年旧项目：不得出现在本年总结", "往年范文", null, false);
        using var exportForm = new MultipartFormDataContent();
        exportForm.Add(new StringContent("2026年1-6月工作总结"), "title");
        exportForm.Add(new StringContent(final.Content), "content");
        exportForm.Add(new StringContent("false"), "preserveHeaderFooter");
        exportForm.Add(new ByteArrayContent(templateBytes), "template", "往年模板.docx");
        using var exported = await client.PostAsync("/api/documents/export", exportForm);
        Assert.Equal(HttpStatusCode.OK, exported.StatusCode);
        var bytesOut = await exported.Content.ReadAsByteArrayAsync();
        using var word = WordprocessingDocument.Open(new MemoryStream(bytesOut), false);
        var actual = word.MainDocumentPart!.Document.Body!.InnerText;
        Assert.Contains("150次", actual);
        Assert.Contains("方案设计", actual);
        Assert.DoesNotContain("往年旧项目", actual);
    }

    [Fact]
    public async Task ApiRejectsCrossSiteWritesAndServerDisablesGlobalKeyPersistence()
    {
        using var factory = new AcceptanceWebFactory();
        using var client = factory.CreateClient();
        using var noHeader = await client.PostAsJsonAsync("/api/settings/key",
            new { apiKey = "fake-do-not-save" });
        Assert.Equal(HttpStatusCode.Forbidden, noHeader.StatusCode);

        client.DefaultRequestHeaders.Add("X-Writer-Client", "ai-document-writer");
        using var withHeader = await client.PostAsJsonAsync("/api/settings/key",
            new { apiKey = "fake-do-not-save" });
        Assert.Equal(HttpStatusCode.Forbidden, withHeader.StatusCode);

        var status = await client.GetFromJsonAsync<JsonElement>("/api/settings/status");
        Assert.False(status.GetProperty("canManageKey").GetBoolean());
    }


    [Fact]
    public async Task SkillCatalogAndSelectedRevisionRunThroughHttp()
    {
        using var factory = new AcceptanceWebFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Writer-Client", "ai-document-writer");
        using var listResponse = await client.GetAsync("/api/skills");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        using var list = JsonDocument.Parse(await listResponse.Content.ReadAsStringAsync());
        Assert.Equal(7, list.RootElement.GetProperty("skills").GetArrayLength());

        const string original = "第一段：保留。\n第二段：需要优化。\n第三段：保留。";
        var start = original.IndexOf("第二段", StringComparison.Ordinal);
        var end = start + "第二段：需要优化。".Length;
        using var revision = await client.PostAsJsonAsync("/api/writing/revise",
            new RevisionRequest(FakeChat(), original, "具体化第二段",
                "selection", start, end, "", "第一段：保留。"));
        Assert.Equal(HttpStatusCode.OK, revision.StatusCode);
        var result = await revision.Content.ReadFromJsonAsync<RevisionResult>();
        Assert.NotNull(result);
        Assert.Equal("第一段：保留。\n第二段：优化后。\n第三段：保留。", result.CandidateText);
        Assert.Equal(original, result.PreviousText);
    }

    private static ChatRequest FakeChat() =>
        new("deepseek-flash", "test", "test", "temporary", "fake-key-for-tests", "disabled", "high");

    private sealed class AcceptanceWebFactory : WebApplicationFactory<Program>
    {
        private readonly string? _previousHostingMode;

        public AcceptanceWebFactory()
        {
            // The production program reads AIWRITER_ config before building the
            // host, so a ConfigureWebHost override alone is too late.
            _previousHostingMode = Environment.GetEnvironmentVariable("AIWRITER_Hosting__Mode");
            Environment.SetEnvironmentVariable("AIWRITER_Hosting__Mode", "Server");
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            Environment.SetEnvironmentVariable("AIWRITER_Hosting__Mode", _previousHostingMode);
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseContentRoot(AppContext.BaseDirectory);
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Hosting:Mode"] = "Server",
                    ["Hosting:OpenBrowser"] = "false",
                    ["AiProvider:BaseUrl"] = "https://example.invalid"
                }));
            builder.ConfigureTestServices(services =>
                services.AddHttpClient<DeepSeekClient>()
                    .ConfigurePrimaryHttpMessageHandler(() => new ScriptedModelHandler()));
        }
    }

    private sealed class ScriptedModelHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal("example.invalid", request.RequestUri!.Host);
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
            var json = body.RootElement;
            var user = json.GetProperty("messages")[1].GetProperty("content").GetString()!;
            string answer;
            if (user.Contains("【正文开始】", StringComparison.Ordinal))
            {
                Assert.Equal("json_object", json.GetProperty("response_format").GetProperty("type").GetString());
                var month = Samples.Single(s => user.Contains("文件：" + s.Month + ".docx", StringComparison.Ordinal)).Month;
                var items = new List<Dictionary<string, string>>();
                if (month is "2026-01" or "2026-02" or "2026-03")
                {
                    var (evidence, description) = month switch
                    {
                        "2026-01" => ("完成迁移方案设计", "完成迁移方案设计"),
                        "2026-02" => ("完成业务接口测试", "完成业务接口测试"),
                        _ => ("完成数据库迁移验收", "完成数据库迁移验收")
                    };
                    items.Add(Fact("WMS数据库迁移", month, evidence, description, ""));
                }
                var count = month switch
                {
                    "2026-01" or "2026-04" => 20,
                    "2026-02" or "2026-05" => 25,
                    _ => 30
                };
                items.Add(Fact("设备巡检", month, "完成设备巡检" + count + "次",
                    "完成设备巡检" + count + "次", count + "次"));
                answer = JsonSerializer.Serialize(new { items });
            }
            else if (user.Contains("请分析归并以下事实", StringComparison.Ordinal))
            {
                Assert.Equal("json_object", json.GetProperty("response_format").GetProperty("type").GetString());
                var groups = new object[]
                {
                    new {
                        title="WMS数据库迁移", kind="progress",
                        memberIds=new[] { "F1-1", "F2-1", "F3-1" },
                        summary="完成方案设计、接口测试与最终验收", metrics="",
                        conflicts=Array.Empty<object>()
                    },
                    new {
                        title="设备巡检", kind="recurring",
                        memberIds=new[] { "F1-2", "F2-2", "F3-2", "F4-1", "F5-1", "F6-1" },
                        summary="持续开展设备巡检", metrics="累计巡检150次",
                        conflicts=Array.Empty<object>()
                    }
                };
                answer = JsonSerializer.Serialize(new { groups });
            }
            else if (user.Contains("【本轮需要修改的文字】", StringComparison.Ordinal))
            {
                answer = "第二段：优化后。";
            }
            else
            {
                answer = "2026年1-6月工作总结：完成WMS迁移方案设计、接口测试及验收，累计设备巡检150次。";
            }
            var response = JsonSerializer.Serialize(new
            {
                choices = new[] { new { message = new { content = answer }, finish_reason = "stop" } },
                usage = new { total_tokens = 64 }
            });
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(response, Encoding.UTF8, "application/json")
            };
        }

        private static Dictionary<string, string> Fact(
            string title, string period, string evidence, string description, string numericEvidence) =>
            new()
            {
                ["title"] = title, ["project"] = title,
                ["period"] = period, ["progress"] = "完成",
                ["description"] = description,
                ["numericEvidence"] = numericEvidence,
                ["evidence"] = evidence
            };
    }
}
