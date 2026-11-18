using System.Net;
using System.Text;
using System.Text.Json;
using AiDocumentWriter.Models;
using AiDocumentWriter.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiDocumentWriter.Tests;

public class SkillRevisionTests
{
    [Fact]
    public void LocalSkillRegistryOnlyLoadsAllowlistedDocuments()
    {
        var catalog = new SkillRegistry();
        Assert.Equal(7, catalog.List().Count);
        var text = catalog.Compose("严格按照原材料写作", "draft-summary", "improve-style");
        Assert.Contains("工作总结写作", text);
        Assert.Contains("中文写作表达优化", text);
        Assert.Contains("严格按照原材料写作", text);
        Assert.Throws<ArgumentException>(() => catalog.Compose("x", "../../secret", null));
        Assert.Throws<ArgumentException>(() => catalog.Compose("x", "draft-summary", "draft-report"));
        Assert.Equal("原始", catalog.Compose("原始", null, null));
    }

    [Fact]
    public async Task SelectedRevisionKeepsUnselectedTextByteForByte()
    {
        var text = "第一段：2026年完成方案设计。\n第二段：描述比较空泛。\n第三段：保留这句原文。";
        var start = text.IndexOf("第二段", StringComparison.Ordinal);
        var end = start + "第二段：描述比较空泛。".Length;
        var service = WithModelOutput("第二段：具体说明了迁移测试工作的范围。");
        var request = new RevisionRequest(FakeChat(), text, "把第二段写具体，其他不动",
            "selection", start, end, "原材料涉及迁移测试", "第三段：保留这句原文。");
        var result = await service.ReviseAsync(request, CancellationToken.None);
        Assert.Equal("第一段：2026年完成方案设计。\n第二段：具体说明了迁移测试工作的范围。\n第三段：保留这句原文。",
            result.CandidateText);
        Assert.Equal(text, result.PreviousText);
        Assert.Equal("selection", result.Scope);
    }

    [Fact]
    public async Task RevisionRefusesRemovalOfProtectedContent()
    {
        var service = WithModelOutput("项目已正常收尾。");
        var request = new RevisionRequest(FakeChat(), "完成WMS项目验收。", "改写",
            "full", null, null, "", "WMS");
        await Assert.ThrowsAsync<ArgumentException>(() => service.ReviseAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task RevisionRejectsInvalidSelectionAndMissingInstruction()
    {
        var service = WithModelOutput("修改文本");
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ReviseAsync(new RevisionRequest(FakeChat(), "一二三", "修订",
                "selection", 1, 6, "", ""), CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ReviseAsync(new RevisionRequest(FakeChat(), "一二三", "",
                "full", null, null, "", ""), CancellationToken.None));
    }

    private static ChatRequest FakeChat() =>
        new("test-model", "system", "user", "temporary", "test-placeholder", "disabled", "high");

    private static WritingRevisionService WithModelOutput(string output)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AiProvider:BaseUrl"] = "https://example.invalid"
        }).Build();
        var keys = new LocalKeyStore(DataProtectionProvider.Create("AiDocumentWriter.SkillTests"));
        var client = new DeepSeekClient(new HttpClient(new StubHandler(output)), cfg, keys, new SkillRegistry());
        return new WritingRevisionService(client);
    }

    [Fact]
    public async Task RevisionRejectsQuantifiedClaimWithoutSource()
    {
        var service = WithModelOutput("本月完成巡检99次。");
        var request = new RevisionRequest(FakeChat(),
            "本月完成巡检5次。", "改善表达", "full", null, null, "本月完成巡检5次。", null);
        var failure = await Assert.ThrowsAsync<ArgumentException>(() => service.ReviseAsync(request, CancellationToken.None));
        Assert.Contains("99次", failure.Message);
    }

    private sealed class StubHandler(string text) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var json = JsonSerializer.Serialize(new
            {
                choices = new[] { new { message = new { content = text }, finish_reason = "stop" } },
                usage = new { total_tokens = 31 }
            });
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            });
        }
    }
}
