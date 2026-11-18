using System.Globalization;
using System.Text.RegularExpressions;
using AiDocumentWriter.Models;

namespace AiDocumentWriter.Services;

internal static class AnnualMetrics
{
    private static readonly Regex Month = new(@"\A[0-9]{4}-(?:0[1-9]|1[0-2])\z", RegexOptions.CultureInvariant);
    private static readonly Regex MonthlyCount = new(
        @"\A(?:本月|当月)(?:新增|完成|处理|开展|办理|执行|受理)?(?<name>[\p{L}·/-]{2,40})(?<value>[0-9]{1,12}(?:\.[0-9]{1,4})?)(?<unit>人次|件|次|项|台|份|批|单|笔|套|家)[。；，]?\z",
        RegexOptions.CultureInvariant);
    private static readonly Regex Snapshot = new("累计|截至|期末|月末|年初至今|同比|环比", RegexOptions.CultureInvariant);

    internal static AnnualConflict NeedsConfirmation(string description) =>
        new() { Severity = "critical", Description = description, Resolution = "pending" };

    internal static string? ReportMonth(AnnualFact fact)
    {
        var month = fact.DeclaredMonth.Trim();
        if (month.Length == 0) month = fact.Period.Trim();
        return Month.IsMatch(month) ? month : null;
    }

    internal static AnnualMetric? Compute(string category, IReadOnlyList<AnnualFact> sources, List<AnnualConflict> conflicts)
    {
        if (category != "recurring" || sources.Count < 2 || conflicts.Any(c => c.Severity == "critical"))
            return null;
        if (sources.All(f => string.IsNullOrWhiteSpace(f.NumericEvidence) && !MonthlyCount.IsMatch(f.Evidence)))
            return null;

        var periods = new HashSet<string>(StringComparer.Ordinal);
        string? name = null, unit = null;
        decimal total = 0;
        foreach (var source in sources)
        {
            var month = ReportMonth(source);
            var match = MonthlyCount.Match(source.Evidence);
            var markerText = source.Evidence + "\n" + source.NumericEvidence;
            // A monthly report can contain cumulative snapshots. Only explicit, standalone
            // monthly counts are eligible and their computed result must cite every member.
            if (!source.EvidenceMatched || !Month.IsMatch(source.DeclaredMonth) || month is null || !match.Success
                || Snapshot.IsMatch(markerText) || markerText.Contains('%') || markerText.Contains('％')
                || (Month.IsMatch(source.Period) && source.Period != month)
                || !periods.Add(month))
            {
                conflicts.Add(NeedsConfirmation("存在累计快照、比例、重复月份或缺少明确当期口径的指标，未计算合计"));
                return null;
            }
            var nameValue = match.Groups["name"].Value;
            var unitValue = match.Groups["unit"].Value;
            name ??= nameValue;
            unit ??= unitValue;
            if (name != nameValue || unit != unitValue)
            {
                conflicts.Add(NeedsConfirmation("指标名称或单位不一致，未计算合计"));
                return null;
            }
            total += decimal.Parse(match.Groups["value"].Value, CultureInfo.InvariantCulture);
        }
        return new AnnualMetric(name!, total, unit!, "monthly", sources.Select(f => f.Id).ToArray());
    }

    internal static string Format(AnnualMetric metric) =>
        $"{metric.Name}合计{metric.Value.ToString("0.####", CultureInfo.InvariantCulture)}{metric.Unit}";
}
