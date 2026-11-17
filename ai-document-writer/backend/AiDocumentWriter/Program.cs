using System.Diagnostics;
using System.Net;
using System.Text.Json;
using AiDocumentWriter.Models;
using AiDocumentWriter.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});
builder.Configuration.AddJsonFile("config/appsettings.local.json", optional: true, reloadOnChange: true);
builder.Configuration.AddEnvironmentVariables(prefix: "AIWRITER_");

var mode = builder.Configuration["Hosting:Mode"] ?? "Desktop";
if (mode.Equals("Desktop", StringComparison.OrdinalIgnoreCase))
{
    // A random loopback port avoids conflicts and never exposes the desktop package to LAN.
    builder.WebHost.UseUrls("http://127.0.0.1:0");
}
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 65L * 1024 * 1024;
});
Directory.CreateDirectory(LocalKeyStore.DataDirectory);
builder.Services.AddDataProtection()
    .SetApplicationName("AiDocumentWriter")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(LocalKeyStore.DataDirectory, "keyring")));
builder.Services.AddSingleton<LocalKeyStore>();
builder.Services.AddSingleton<DocxParser>();
builder.Services.AddHttpClient<DeepSeekClient>(c => c.Timeout = TimeSpan.FromMinutes(6));

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();

// Require a non-simple same-origin header on all state-changing endpoints.
// This blocks HTML form CSRF attempts against the loopback service.
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api")
        && context.Request.Method is not ("GET" or "HEAD" or "OPTIONS")
        && context.Request.Headers["X-Writer-Client"] != "ai-document-writer")
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    await next();
});
bool CanSaveKey(HttpContext ctx) =>
    mode.Equals("Desktop", StringComparison.OrdinalIgnoreCase)
    && ctx.Connection.RemoteIpAddress is { } ip && IPAddress.IsLoopback(ip);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/settings/status", (HttpContext ctx, IConfiguration cfg, LocalKeyStore keys) =>
    Results.Ok(new
    {
        serverKeyConfigured = !string.IsNullOrWhiteSpace(cfg["AiProvider:ApiKey"]),
        savedKeyConfigured = keys.HasSavedKey,
        canManageKey = CanSaveKey(ctx),
        defaultModel = cfg["AiProvider:DefaultModel"] ?? "deepseek-chat"
    }));

app.MapPost("/api/settings/key", (HttpContext ctx, SaveKeyRequest request, LocalKeyStore keys) =>
{
    if (!CanSaveKey(ctx)) return Results.Problem("仅桌面本机模式允许持久化页面 API Key", statusCode: 403);
    if (string.IsNullOrWhiteSpace(request.ApiKey) || request.ApiKey.Length > 1024)
        return Results.BadRequest(new { error = "请输入有效的 API Key（最多 1024 字符）" });
    try
    {
        keys.Save(request.ApiKey);
        return Results.Ok(new { saved = true });
    }
    catch
    {
        return Results.Problem("保存密钥失败，请检查用户目录写入权限", statusCode: 500);
    }
});
app.MapDelete("/api/settings/key", (HttpContext ctx, LocalKeyStore keys) =>
{
    if (!CanSaveKey(ctx)) return Results.Problem("仅桌面本机模式允许删除本地 API Key", statusCode: 403);
    keys.Delete();
    return Results.Ok(new { saved = false });
});

app.MapPost("/api/llm/chat", async (ChatRequest request, DeepSeekClient client, HttpContext ctx) =>
{
    try
    {
        var result = await client.ChatAsync(request, ctx.RequestAborted);
        return Results.Ok(result);
    }
    catch (OperationCanceledException)
    {
        return Results.StatusCode(499);
    }
    catch (ArgumentException e)
    {
        return Results.BadRequest(new { error = e.Message });
    }
    catch (HttpRequestException e)
    {
        return Results.Problem(e.Message, statusCode: 502);
    }
    catch
    {
        return Results.Problem("模型请求失败，请检查服务端配置或网络连接", statusCode: 500);
    }
});

app.MapPost("/api/documents/parse", async (HttpRequest request, DocxParser parser, IConfiguration cfg) =>
{
    if (!request.HasFormContentType) return Results.BadRequest(new { error = "请上传 DOCX 文件" });
    var form = await request.ReadFormAsync(request.HttpContext.RequestAborted);
    var files = form.Files;
    var maxFiles = Math.Clamp(cfg.GetValue("Document:MaxFiles", 15), 1, 30);
    var perFile = Math.Clamp(cfg.GetValue("Document:MaxFileSizeMB", 8), 1, 30) * 1024L * 1024L;
    var total = Math.Clamp(cfg.GetValue("Document:MaxTotalSizeMB", 60), 1, 120) * 1024L * 1024L;
    if (files.Count == 0 || files.Count > maxFiles || files.Any(f => f.Length == 0 || f.Length > perFile)
        || files.Sum(f => f.Length) > total)
        return Results.BadRequest(new { error = "文件数量或体积超出限制，请检查配置" });
    try
    {
        var docs = files.Select(parser.Parse).ToArray();
        return Results.Ok(new { documents = docs });
    }
    catch (Exception e) when (e is ArgumentException or InvalidDataException or System.IO.FileFormatException or IOException
        or DocumentFormat.OpenXml.Packaging.OpenXmlPackageException)
    {
        return Results.BadRequest(new { error = "DOCX 读取失败：" + e.Message });
    }
});
app.MapFallbackToFile("index.html");

await app.StartAsync();
if (mode.Equals("Desktop", StringComparison.OrdinalIgnoreCase)
    && builder.Configuration.GetValue("Hosting:OpenBrowser", true))
{
    var server = app.Services.GetRequiredService<IServer>();
    var address = server.Features.Get<IServerAddressesFeature>()?.Addresses
        .FirstOrDefault(a => a.StartsWith("http://127.0.0.1:", StringComparison.Ordinal));
    if (address is not null)
    {
        Console.WriteLine("AI 文档助手：" + address);
        try { Process.Start(new ProcessStartInfo(address) { UseShellExecute = true }); }
        catch { Console.WriteLine("浏览器未自动打开，请复制以上地址访问"); }
    }
}
await app.WaitForShutdownAsync();

public sealed record SaveKeyRequest(string ApiKey);
