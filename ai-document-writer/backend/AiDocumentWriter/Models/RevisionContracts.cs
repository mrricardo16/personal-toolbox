namespace AiDocumentWriter.Models;

public sealed record RevisionRequest(
    ChatRequest Chat,
    string CurrentText,
    string Instruction,
    string Scope,
    int? SelectionStart,
    int? SelectionEnd,
    string? FactContext,
    string? ProtectedTerms,
    bool ImproveStyle = false);

public sealed record RevisionResult(
    string CandidateText,
    string PreviousText,
    string Scope,
    string OriginalSelection,
    string Replacement,
    System.Text.Json.JsonElement? Usage);
