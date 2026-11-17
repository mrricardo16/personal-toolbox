using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AiDocumentWriter.Models;

namespace AiDocumentWriter.Services;

public sealed class DeepSeekClient(HttpClient http, IConfiguration configuration, LocalKeyStore keyStore, SkillRegistry? skills = null)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<ChatResult> ChatAsync(ChatRequest request, CancellationToken ct)
    {
        var source = request.KeySource?.Trim().ToLowerInvariant() ?? "server";
        string? key = source switch
        {
            "server" => configuration["AiProvider:ApiKey"],
            "saved" => keyStore.Read(),
            "temporary" => request.TemporaryApiKey,
            _ => throw new ArgumentException("无效的 API Key 来源")
        };
        if (string.IsNullOrWhiteSpace(key)) throw new ArgumentException("当前密钥来源尚未配置 API Key");
        if (string.IsNullOrWhiteSpace(request.UserPrompt) || string.IsNullOrWhiteSpace(request.SystemPrompt))
            throw new ArgumentException("系统指令和用户指令不能为空");
        var finalSystemPrompt = (skills ?? new SkillRegistry()).Compose(request.SystemPrompt, request.WritingSkillId, request.EnhancementSkillId);
        if (request.UserPrompt.Length > 100_000 || finalSystemPrompt.Length > 30_000)
            throw new ArgumentException("材料过长；当前版本单次请求限制为 100000 字符。多文档分段分析将在 P2 支持");

        var model = string.IsNullOrWhiteSpace(request.Model)
            ? configuration["AiProvider:DefaultModel"] ?? "deepseek-flash"
            : request.Model.Trim();
        var baseUrl = (configuration["AiProvider:BaseUrl"] ?? "https://api.deepseek.com").TrimEnd('/');
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var endpoint) || endpoint.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("AiProvider:BaseUrl 必须为 HTTPS 地址");

        var payload = new Dictionary<string, object?>
        {
            ["model"] = model,
            ["messages"] = new[]
            {
                new { role = "system", content = finalSystemPrompt },
                new { role = "user", content = request.UserPrompt }
            },
            ["temperature"] = 0.2,
            ["max_tokens"] = request.JsonMode ? 16384 : 8192,
            ["stream"] = false,
            ["thinking"] = new { type = request.ThinkingType == "enabled" ? "enabled" : "disabled" },
            ["reasoning_effort"] = request.ReasoningEffort is "low" or "high" or "max"
                ? request.ReasoningEffort : "high"
        };
        if (request.JsonMode) payload["response_format"] = new { type = "json_object" };
        using var message = new HttpRequestMessage(HttpMethod.Post, baseUrl + "/chat/completions");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key.Trim());
        message.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            // Never leak upstream response bodies, which may echo submitted values.
            throw new HttpRequestException("DeepSeek API 返回 HTTP " + (int)response.StatusCode);
        }
        using var json = JsonDocument.Parse(raw);
        var root = json.RootElement;
        if (!root.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
            throw new InvalidOperationException("API 返回格式不正确");
        var item = choices[0];
        var finish = item.TryGetProperty("finish_reason", out var reason) ? reason.GetString() ?? "" : "";
        var content = item.GetProperty("message").GetProperty("content").GetString() ?? "";
        if (string.IsNullOrWhiteSpace(content)) throw new InvalidOperationException("API 未返回有效正文");
        if (finish == "length") throw new InvalidOperationException("模型输出达到长度限制，当前结果不完整；请缩短任务");
        JsonElement? usage = root.TryGetProperty("usage", out var token) ? token.Clone() : null;
        return new ChatResult(content, finish, usage);
    }
}
