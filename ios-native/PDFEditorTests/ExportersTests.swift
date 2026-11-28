import XCTest
@testable import PDFEditor

final class ExportersTests: XCTestCase {
    private func page(_ lines: [String]) -> TextPage {
        TextPage(
            size: CGSize(width: 400, height: 300),
            lines: lines.enumerated().map { index, text in
                TextLine(text: text, bounds: CGRect(x: 0, y: 200 - index * 20, width: 100, height: 12), fontSize: 12)
            }
        )
    }

    func testTextJoinsLinesAndSeparatesPages() {
        let text = Exporters.text([page(["One", "Two"]), page(["Three"])])
        XCTAssertEqual(text, "One\nTwo\n\nThree")
    }

    func testCsvSplitsColumnsOnWideGaps() {
        XCTAssertEqual(Exporters.cells(of: "Design work   12   1,200.00"), ["Design work", "12", "1,200.00"])
        XCTAssertEqual(Exporters.csv([page(["Item  Price", "Logo, v2  10"])]), "Item,Price\r\n\"Logo, v2\",10")
    }

    func testCsvEscapesQuotes() {
        XCTAssertEqual(Exporters.escapeCSV("say \"hi\""), "\"say \"\"hi\"\"\"")
        XCTAssertEqual(Exporters.escapeCSV("plain"), "plain")
    }

    func testHtmlEscapesMarkup() {
        let html = Exporters.html([page(["a < b & c"])], title: "T<1>")
        XCTAssertTrue(html.contains("<p>a &lt; b &amp; c</p>"))
        XCTAssertTrue(html.contains("<title>T&lt;1&gt;</title>"))
        XCTAssertTrue(html.hasPrefix("<!doctype html>"))
    }

    func testDocxContainsTheRequiredParts() {
        let data = Exporters.docx([page(["Hello"]), page(["World"])])
        let raw = String(decoding: data, as: UTF8.self)
        XCTAssertTrue(raw.contains("[Content_Types].xml"))
        XCTAssertTrue(raw.contains("_rels/.rels"))
        XCTAssertTrue(raw.contains("word/document.xml"))
        XCTAssertTrue(raw.contains("<w:t xml:space=\"preserve\">Hello</w:t>"))
        XCTAssertTrue(raw.contains("<w:br w:type=\"page\"/>"))
    }

    func testEveryFormatHasAnExtensionAndLabel() {
        for format in ExportFormat.allCases {
            XCTAssertFalse(format.label.isEmpty)
            XCTAssertEqual(format.fileExtension, format.rawValue)
        }
    }
}
