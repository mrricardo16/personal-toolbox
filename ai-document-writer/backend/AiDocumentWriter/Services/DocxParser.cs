using System.Text;
using AiDocumentWriter.Models;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace AiDocumentWriter.Services;

public sealed class DocxParser
{
    private const int MaxExtractedCharacters = 150_000;

    public ParsedDocument Parse(IFormFile file)
    {
        if (!Path.GetExtension(file.FileName).Equals(".docx", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("仅支持 .docx 文件");
        using var stream = new MemoryStream();
        file.CopyTo(stream);
        stream.Position = 0;
        if (stream.Length < 4 || stream.ReadByte() != 0x50 || stream.ReadByte() != 0x4b)
            throw new ArgumentException("文件不是有效的 DOCX 压缩包");
        stream.Position = 0;
        using var doc = WordprocessingDocument.Open(stream, false);
        var body = doc.MainDocumentPart?.Document?.Body
            ?? throw new ArgumentException("DOCX 文件缺少正文");
        var text = new StringBuilder();
        var tables = 0;

        void AppendLine(string line)
        {
            if (text.Length + line.Length > MaxExtractedCharacters)
                throw new ArgumentException("DOCX 解压后的文本过长，请拆分文档");
            text.AppendLine(line);
        }

        foreach (var block in body.Elements())
        {
            if (block is Paragraph paragraph)
            {
                var line = string.Concat(paragraph.Descendants<Text>().Select(t => t.Text));
                if (string.IsNullOrWhiteSpace(line)) continue;
                var style = paragraph.ParagraphProperties?.ParagraphStyleId?.Val?.Value;
                var prefix = style?.StartsWith("Heading", StringComparison.OrdinalIgnoreCase) == true
                    ? "# " : "";
                AppendLine(prefix + line);
            }
            else if (block is Table table)
            {
                tables++;
                foreach (var row in table.Elements<TableRow>())
                {
                    var cells = row.Elements<TableCell>()
                        .Select(cell => string.Join(" ", cell.Descendants<Paragraph>()
                            .Select(p => string.Concat(p.Descendants<Text>().Select(t => t.Text)))
                            .Where(s => !string.IsNullOrWhiteSpace(s))));
                    AppendLine(string.Join(" | ", cells));
                }
            }
        }
        return new ParsedDocument(Path.GetFileName(file.FileName), text.ToString().Trim(), text.Length, tables);
    }
}
