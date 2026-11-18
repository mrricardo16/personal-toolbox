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
    public void ExplicitWritingRequirementsWinOverDraftAndEnhancementSkills()
    {
        var catalog = new SkillRegistry();
        var composed = catalog.Compose("基础指令", "draft-summary", "improve-style");
        Assert.Contains("工作总结写作", composed);
        Assert.Contains("中文写作表达优化", composed);
        Assert.Contains("本轮用户明确写作要求是最高优先级的任务约束", composed);
        Assert.Contains("与任何 Skill 的建议冲突时，以用户本轮要求为准", composed);
        Assert.Contains("要求按月组织就按月组织；要求不按月组织就不得套用月度章节", composed);
        Assert.Contains("要求简洁就压缩；要求详细就在事实支持下展开", composed);
        Assert.Contains("要求突出某项就优先呈现该项", composed);
        Assert.Contains("事实真实性、安全、逐字保护项和当前步骤的输出契约", composed);
    }

    [Theory]
    [InlineData("按月组织，突出巡检", "简洁")]
    [InlineData("按专题组织，不按月组织，突出验收", "详细")]
    public async Task SkillChatKeepsExplicitTaskAndStylePreferencesInTheUserMessage(string task, string length)
    {
        var client = ClientWithModelOutput("模拟结果", payload =>
        {
            using var json = JsonDocument.Parse(payload);
            var messages = json.RootElement.GetProperty("messages");
            var system = messages[0].GetProperty("content").GetString();
            var user = messages[1].GetProperty("content").GetString();
            Assert.Contains("与任何 Skill 的建议冲突时，以用户本轮要求为准", system);
            Assert.DoesNotContain(task, system);
            Assert.StartsWith("【用户明确写作约束】", user);
            Assert.Contains(task, user);
            Assert.Contains(length, user);
            Assert.Contains("保留指定重点并使用中性书面语", user);
            Assert.Contains("输入事实", user);
        });

        await client.ChatAsync(FakeChat() with
        {
            UserPrompt = "输入事实",
            WritingSkillId = "draft-summary",
            EnhancementSkillId = "improve-style",
            WritingRequirements = new WritingRequirements(Length: length, Task: task, Extra: "保留指定重点并使用中性书面语")
        }, default);
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

    private static WritingRevisionService WithModelOutput(string output) => new(ClientWithModelOutput(output));

    private static DeepSeekClient ClientWithModelOutput(string output, Action<string>? inspect = null)
    {
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AiProvider:BaseUrl"] = "https://example.invalid"
        }).Build();
        var keys = new LocalKeyStore(DataProtectionProvider.Create("AiDocumentWriter.SkillTests"));
        return new DeepSeekClient(new HttpClient(new StubHandler(output, inspect)), cfg, keys, new SkillRegistry());
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

    private sealed class StubHandler(string text, Action<string>? inspect) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (inspect is not null) inspect(await request.Content!.ReadAsStringAsync(ct));
            var json = JsonSerializer.Serialize(new
            {
                choices = new[] { new { message = new { content = text }, finish_reason = "stop" } },
                usage = new { total_tokens = 31 }
            });
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }
    }
}
