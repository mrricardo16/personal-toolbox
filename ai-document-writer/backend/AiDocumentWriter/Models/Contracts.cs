namespace AiDocumentWriter.Models;

public sealed record ChatRequest(
    string? Model,
    string? SystemPrompt,
    string? UserPrompt,
    string? KeySource,
    string? TemporaryApiKey,
    string? ThinkingType,
    string? ReasoningEffort
);

public sealed record ChatResult(string Content, string FinishReason, System.Text.Json.JsonElement? Usage);

public sealed record ParsedDocument(string FileName, string Content, int CharacterCount, int TableCount);
