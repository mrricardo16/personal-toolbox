using System.Text.Json;

namespace AiDocumentWriter.Models;

public sealed record AnnualInputDocument(string Id, string FileName, string? Month, string Content);
public sealed record AnnualExtractRequest(AnnualInputDocument Document, ChatRequest Chat);
public sealed record AnnualExtractResult(List<AnnualFact> Items, int UnmatchedEvidenceCount, JsonElement? Usage);
public sealed record AnnualMergeRequest(List<AnnualFact> Facts, string? Requirement, ChatRequest Chat);
public sealed record AnnualMergeResult(List<AnnualGroup> Groups, JsonElement? Usage);

public sealed class AnnualFact
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Project { get; set; } = "";
    public string Period { get; set; } = "";
    public string Progress { get; set; } = "";
    public string Description { get; set; } = "";
    public string NumericEvidence { get; set; } = "";
    public string SourceFile { get; set; } = "";
    public string SourceId { get; set; } = "";
    public string Evidence { get; set; } = "";
    public bool EvidenceMatched { get; set; }
}
public sealed class AnnualConflict
{
    public string Severity { get; set; } = "normal";
    public string Description { get; set; } = "";
    public string Resolution { get; set; } = "pending";
}
public sealed class AnnualGroup
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "independent";
    public List<string> MemberIds { get; set; } = [];
    public string Summary { get; set; } = "";
    public string Metrics { get; set; } = "";
    public List<AnnualConflict> Conflicts { get; set; } = [];
    public bool Included { get; set; } = true;
}
