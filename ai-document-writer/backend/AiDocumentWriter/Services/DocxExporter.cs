using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text.RegularExpressions;

namespace AiDocumentWriter.Services;

/// <summary>
/// Builds a new editable Word body. When a template is supplied, paragraph styles,
/// table styles and section/page layout remain available, but original document body
/// is removed. Static header/footer text is blanked unless explicitly approved.
/// </summary>
public sealed class DocxExporter
{
    public byte[] Export(string content, string? title, Stream? template, bool preserveHeaderFooter)
    {
        if (string.IsNullOrWhiteSpace(content)) throw new ArgumentException("文稿内容不能为空");
        if (content.Length > 150_000) throw new ArgumentException("导出内容过长");
        var target = new MemoryStream();
        if (template is not null)
        {
            template.CopyTo(target);
            target.Position = 0;
            using var doc = WordprocessingDocument.Open(target, true);
            var main = doc.MainDocumentPart ?? throw new ArgumentException("模板缺少主文档");
            var body = main.Document.Body ?? throw new ArgumentException("模板缺少正文");
            var section = body.Elements<SectionProperties>().FirstOrDefault()?.CloneNode(true) as SectionProperties;
            body.RemoveAllChildren();
            AddContent(body, content, title, main);
            if (section is not null) body.Append(section);
            if (!preserveHeaderFooter)
            {
                foreach (var part in main.HeaderParts)
                {
                    foreach (var txt in part.Header.Descendants<Text>()) txt.Text = "";
                    part.Header.Save();
                }
                foreach (var part in main.FooterParts)
                {
                    foreach (var txt in part.Footer.Descendants<Text>()) txt.Text = "";
                    part.Footer.Save();
                }
            }
            main.Document.Save();
        }
        else
        {
            using var doc = WordprocessingDocument.Create(target, WordprocessingDocumentType.Document, true);
            var main = doc.AddMainDocumentPart();
            main.Document = new Document(new Body());
            CreateStyles(main);
            AddContent(main.Document.Body!, content, title, main);
            main.Document.Save();
        }
        return target.ToArray();
    }

    private static void AddContent(Body body, string source, string? title, MainDocumentPart main)
    {
        if (!string.IsNullOrWhiteSpace(title) && !source.TrimStart().StartsWith(title.Trim(), StringComparison.Ordinal))
            body.Append(CreateParagraph(title.Trim(), "Title"));
        var text = source.Replace("\r\n", "\n").Replace('\r', '\n');
        var lines = text.Split('\n');
        var firstTemplateTableStyle = main.Document.Body?.Elements<Table>()
            .Select(t => t.GetFirstChild<TableProperties>()?.TableStyle?.Val?.Value)
            .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        // Main document body may have already been cleared. Tables still use an
        // editable standard border style if the template did not define one.
        for (var i = 0; i < lines.Length; i++)
        {
            var line = lines[i].TrimEnd();
            if (string.IsNullOrWhiteSpace(line))
            {
                body.Append(new Paragraph());
                continue;
            }
            if (line.StartsWith('|') && line.EndsWith('|'))
            {
                var cells = new List<string[]>();
                while (i < lines.Length && lines[i].Trim().StartsWith('|') && lines[i].Trim().EndsWith('|'))
                {
                    var row = lines[i].Trim().Trim('|').Split('|').Select(c => c.Trim()).ToArray();
                    if (!row.All(c => Regex.IsMatch(c, @"^:?-{3,}:?$"))) cells.Add(row);
                    i++;
                }
                i--;
                if (cells.Count > 0) body.Append(CreateTable(cells, firstTemplateTableStyle));
                continue;
            }
            var heading = Regex.Match(line, @"^(#{1,3})\s+(.+)$");
            if (heading.Success)
            {
                body.Append(CreateParagraph(heading.Groups[2].Value, "Heading" + heading.Groups[1].Value.Length));
                continue;
            }
            if (Regex.IsMatch(line, @"^[一二三四五六七八九十]+、"))
            {
                body.Append(CreateParagraph(line, "Heading1"));
                continue;
            }
            if (Regex.IsMatch(line, @"^（[一二三四五六七八九十]+）"))
            {
                body.Append(CreateParagraph(line, "Heading2"));
                continue;
            }
            body.Append(CreateParagraph(line.TrimStart(), "Normal"));
        }
    }

    private static Paragraph CreateParagraph(string text, string style)
    {
        var paragraph = new Paragraph();
        paragraph.ParagraphProperties = new ParagraphProperties(new ParagraphStyleId { Val = style });
        paragraph.Append(new Run(new Text(text) { Space = SpaceProcessingModeValues.Preserve }));
        return paragraph;
    }

    private static Table CreateTable(List<string[]> rows, string? style)
    {
        var table = new Table();
        var props = new TableProperties(
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 }
            ));
        if (!string.IsNullOrWhiteSpace(style)) props.Append(new TableStyle { Val = style });
        table.Append(props);
        foreach (var cells in rows)
        {
            var row = new TableRow();
            foreach (var cell in cells)
            {
                var tc = new TableCell(CreateParagraph(cell, "Normal"),
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
