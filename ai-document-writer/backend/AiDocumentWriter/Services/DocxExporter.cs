using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text.RegularExpressions;

namespace AiDocumentWriter.Services;

/// <summary>
/// Creates a fresh DOCX package. Only reusable formatting parts are copied from
/// templates; old body, comments, tracked changes, attachments and document
/// properties are never copied into the generated document.
/// </summary>
public sealed class DocxExporter
{
    public byte[] Export(string content, string? title, Stream? template, bool preserveHeaderFooter)
    {
        if (string.IsNullOrWhiteSpace(content)) throw new ArgumentException("文稿内容不能为空");
        if (content.Length > 150_000) throw new ArgumentException("导出内容过长");

        var target = new MemoryStream();
        using (var resultDoc = WordprocessingDocument.Create(target, WordprocessingDocumentType.Document, true))
        {
            var main = resultDoc.AddMainDocumentPart();
            main.Document = new Document(new Body());
            SectionProperties? section = null;
            string? tableStyle = null;
            if (template is not null)
            {
                template.Position = 0;
                using var reference = WordprocessingDocument.Open(template, false);
                var originalMain = reference.MainDocumentPart
                    ?? throw new ArgumentException("参考模板缺少 Word 主文档");
                section = originalMain.Document.Body?.Elements<SectionProperties>().FirstOrDefault()
                    ?.CloneNode(true) as SectionProperties;
                tableStyle = originalMain.Document.Body?.Elements<Table>()
                    .Select(t => t.GetFirstChild<TableProperties>()?.TableStyle?.Val?.Value)
                    .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));

                if (originalMain.StyleDefinitionsPart is { } styles) main.AddPart(styles);
                else CreateStyles(main);
                if (originalMain.NumberingDefinitionsPart is { } numbering) main.AddPart(numbering);
                if (originalMain.ThemePart is { } theme) main.AddPart(theme);
                if (originalMain.FontTablePart is { } fontTable) main.AddPart(fontTable);

                if (section is not null)
                {
                    if (preserveHeaderFooter)
                    {
                        foreach (var header in originalMain.HeaderParts)
                            main.AddPart(header, originalMain.GetIdOfPart(header));
                        foreach (var footer in originalMain.FooterParts)
                            main.AddPart(footer, originalMain.GetIdOfPart(footer));
                    }
                    else
                    {
                        foreach (var header in section.Elements<HeaderReference>().ToList()) header.Remove();
                        foreach (var footer in section.Elements<FooterReference>().ToList()) footer.Remove();
                    }
                }
            }
            else CreateStyles(main);

            AddContent(main.Document.Body!, content, title, tableStyle, main);
            if (section is not null) main.Document.Body!.Append(section);
            main.Document.Save();
        }
        return target.ToArray();
    }

    private static void AddContent(Body body, string source, string? title, string? tableStyle, MainDocumentPart main)
    {
        var firstLine = source.TrimStart().Split('\n', 2)[0].Trim().TrimStart('#').Trim();
        if (!string.IsNullOrWhiteSpace(title) && !string.Equals(firstLine, title.Trim(), StringComparison.Ordinal))
            body.Append(CreateParagraph(title.Trim(), ResolveStyle(main, "Title")));

        var lines = source.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            var line = lines[i].TrimEnd();
            if (string.IsNullOrWhiteSpace(line))
            {
                body.Append(new Paragraph());
                continue;
            }
            if (line.Trim().StartsWith('|') && line.Trim().EndsWith('|'))
            {
                var cells = new List<string[]>();
                while (i < lines.Length && lines[i].Trim().StartsWith('|') && lines[i].Trim().EndsWith('|'))
                {
                    var row = lines[i].Trim().Trim('|').Split('|').Select(c => c.Trim()).ToArray();
                    if (!row.All(c => Regex.IsMatch(c, @"^:?-{3,}:?$"))) cells.Add(row);
                    i++;
                }
                i--;
                if (cells.Count > 0) body.Append(CreateTable(cells, tableStyle, ResolveStyle(main, "Normal")));
                continue;
            }
            var heading = Regex.Match(line, @"^(#{1,3})\s+(.+)$");
            if (heading.Success)
            {
                var level = heading.Groups[1].Value.Length;
                body.Append(CreateParagraph(heading.Groups[2].Value, ResolveStyle(main, "Heading" + level)));
                continue;
            }
            if (Regex.IsMatch(line, @"^[一二三四五六七八九十]+、"))
            {
                body.Append(CreateParagraph(line, ResolveStyle(main, "Heading1")));
                continue;
            }
            if (Regex.IsMatch(line, @"^（[一二三四五六七八九十]+）"))
            {
                body.Append(CreateParagraph(line, ResolveStyle(main, "Heading2")));
                continue;
            }
            body.Append(CreateParagraph(line.TrimStart(), ResolveStyle(main, "Normal")));
        }
    }

    private static string ResolveStyle(MainDocumentPart main, string desired)
    {
        var styles = main.StyleDefinitionsPart?.Styles?.Elements<Style>() ?? [];
        var direct = styles.FirstOrDefault(s => string.Equals(s.StyleId?.Value, desired, StringComparison.OrdinalIgnoreCase));
        if (direct is not null) return direct.StyleId?.Value ?? desired;
        var normalized = desired.ToLowerInvariant();
        var matches = normalized switch
        {
            "title" => new[] { "title", "标题" },
            "heading1" => new[] { "heading 1", "标题 1", "标题1" },
            "heading2" => new[] { "heading 2", "标题 2", "标题2" },
            "heading3" => new[] { "heading 3", "标题 3", "标题3" },
            _ => new[] { "normal", "正文" }
        };
        var result = styles.FirstOrDefault(s => matches.Contains(s.StyleName?.Val?.Value?.ToLowerInvariant() ?? ""));
        return result?.StyleId?.Value ?? desired;
    }

    private static Paragraph CreateParagraph(string text, string style)
    {
        var paragraph = new Paragraph(new ParagraphProperties(new ParagraphStyleId { Val = style }));
        paragraph.Append(new Run(new Text(text) { Space = SpaceProcessingModeValues.Preserve }));
        return paragraph;
    }

    private static Table CreateTable(List<string[]> rows, string? style, string paragraphStyle)
    {
        var props = new TableProperties(
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 }));
        if (!string.IsNullOrWhiteSpace(style)) props.Append(new TableStyle { Val = style });
        var table = new Table(props);
        foreach (var cells in rows)
        {
            var row = new TableRow();
            foreach (var cell in cells)
            {
                var tc = new TableCell(CreateParagraph(cell, paragraphStyle),
                    new TableCellProperties(new TableCellWidth { Type = TableWidthUnitValues.Auto }));
                row.Append(tc);
            }
            table.Append(row);
        }
        return table;
    }

    private static void CreateStyles(MainDocumentPart main)
    {
        var part = main.AddNewPart<StyleDefinitionsPart>();
        var styles = new Styles();
        foreach (var (id, name, size, bold) in new (string, string, string, bool)[]
        {
            ("Normal", "Normal", "22", false),
            ("Title", "Title", "36", true),
            ("Heading1", "heading 1", "30", true),
            ("Heading2", "heading 2", "26", true),
            ("Heading3", "heading 3", "24", true)
        })
        {
            var style = new Style { Type = StyleValues.Paragraph, StyleId = id, Default = id == "Normal" };
            style.Append(new StyleName { Val = name });
            var runProps = new StyleRunProperties(new FontSize { Val = size });
            if (bold) runProps.Append(new Bold());
            style.Append(runProps);
            styles.Append(style);
        }
        part.Styles = styles;
        part.Styles.Save();
    }
}
