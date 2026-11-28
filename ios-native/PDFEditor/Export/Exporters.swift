import Foundation

enum ExportFormat: String, CaseIterable, Identifiable {
    case pdf
    case docx
    case html
    case csv
    case txt
    case png
    case jpg

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pdf: return "PDF document"
        case .docx: return "Word document"
        case .html: return "Web page"
        case .csv: return "Spreadsheet"
        case .txt: return "Plain text"
        case .png: return "PNG image of this page"
        case .jpg: return "JPEG image of this page"
        }
    }

    var fileExtension: String { rawValue }

    var symbol: String {
        switch self {
        case .pdf: return "doc.richtext"
        case .docx: return "doc.text"
        case .html: return "globe"
        case .csv: return "tablecells"
        case .txt: return "text.alignleft"
        case .png, .jpg: return "photo"
        }
    }
}

enum Exporters {
    static func text(_ pages: [TextPage]) -> String {
        pages
            .map { page in page.lines.map(\.text).joined(separator: "\n") }
            .joined(separator: "\n\n")
    }

    static func csv(_ pages: [TextPage]) -> String {
        pages
            .flatMap(\.lines)
            .map { line in cells(of: line.text).map(escapeCSV).joined(separator: ",") }
            .joined(separator: "\r\n")
    }

    static func html(_ pages: [TextPage], title: String) -> String {
        let sections = pages.map { page -> String in
            let paragraphs = page.lines
                .map { "      <p>\(escapeXML($0.text))</p>" }
                .joined(separator: "\n")
            return "    <section class=\"page\">\n\(paragraphs)\n    </section>"
        }
        .joined(separator: "\n")
        return """
            <!doctype html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>\(escapeXML(title))</title>
                <style>
                  body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; background: #f2f3f5; color: #111; }
                  .page { background: #fff; max-width: 800px; margin: 24px auto; padding: 48px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12); }
                  p { margin: 0 0 8px; line-height: 1.45; }
                </style>
              </head>
              <body>
            \(sections)
              </body>
            </html>
            """
    }

    static func docx(_ pages: [TextPage]) -> Data {
        var paragraphs: [String] = []
        for (index, page) in pages.enumerated() {
            for line in page.lines {
                let halfPoints = max(Int((line.fontSize * 2).rounded()), 12)
                paragraphs.append(
                    "<w:p><w:r><w:rPr><w:sz w:val=\"\(halfPoints)\"/></w:rPr>"
                        + "<w:t xml:space=\"preserve\">\(escapeXML(line.text))</w:t></w:r></w:p>"
                )
            }
            if index < pages.count - 1 {
                paragraphs.append("<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>")
            }
        }
        let document =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            + "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>"
            + paragraphs.joined()
            + "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/></w:sectPr></w:body></w:document>"
        let contentTypes =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
            + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
            + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
            + "<Override PartName=\"/word/document.xml\" "
            + "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
            + "</Types>"
        let relationships =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
            + "<Relationship Id=\"rId1\" "
            + "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
            + "Target=\"word/document.xml\"/>"
            + "</Relationships>"
        var zip = ZipWriter()
        zip.add(name: "[Content_Types].xml", content: Data(contentTypes.utf8))
        zip.add(name: "_rels/.rels", content: Data(relationships.utf8))
        zip.add(name: "word/document.xml", content: Data(document.utf8))
        return zip.finalize()
    }

    static func cells(of line: String) -> [String] {
        var cells: [String] = []
        var current = ""
        var spaces = 0
        for character in line {
            if character == "\t" {
                cells.append(current)
                current = ""
                spaces = 0
            } else if character == " " {
                spaces += 1
            } else {
                if spaces >= 2 {
                    cells.append(current)
                    current = ""
                } else if spaces == 1 {
                    current.append(" ")
                }
                spaces = 0
                current.append(character)
            }
        }
        cells.append(current)
        return cells.map { $0.trimmingCharacters(in: .whitespaces) }
    }

    static func escapeCSV(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) else {
            return value
        }
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }

    static func escapeXML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}
