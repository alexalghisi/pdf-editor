import XCTest
@testable import PDFEditor

final class TextLayoutTests: XCTestCase {
    func testMergeDropsLinesCoveredByAReplacement() {
        let original = CGRect(x: 40, y: 200, width: 120, height: 14)
        let lines = [
            TextLine(text: "Old", bounds: original, fontSize: 12),
            TextLine(text: "Keep", bounds: CGRect(x: 40, y: 160, width: 80, height: 14), fontSize: 12),
        ]
        let replacement = TestSupport.element(
            text: "New",
            frame: original,
            kind: .replacement(originalBounds: original, originalText: "Old")
        )
        let merged = TextLayout.merge(lines: lines, elements: [replacement])
        XCTAssertEqual(merged.map(\.text), ["New", "Keep"])
    }

    func testMergeTreatsAnEmptyReplacementAsDeletion() {
        let original = CGRect(x: 40, y: 200, width: 120, height: 14)
        let lines = [TextLine(text: "Old", bounds: original, fontSize: 12)]
        let replacement = TestSupport.element(
            text: "",
            frame: original,
            kind: .replacement(originalBounds: original, originalText: "Old")
        )
        XCTAssertTrue(TextLayout.merge(lines: lines, elements: [replacement]).isEmpty)
    }

    func testMergeOrdersTopToBottomThenLeftToRight() {
        let lines = [
            TextLine(text: "bottom", bounds: CGRect(x: 10, y: 20, width: 50, height: 10), fontSize: 10),
            TextLine(text: "right", bounds: CGRect(x: 200, y: 100, width: 50, height: 10), fontSize: 10),
        ]
        let added = TestSupport.element(text: "left", frame: CGRect(x: 10, y: 100, width: 50, height: 10))
        let image = TestSupport.element(text: "", frame: CGRect(x: 0, y: 0, width: 10, height: 10), kind: .image(Data()))
        let merged = TextLayout.merge(lines: lines, elements: [added, image])
        XCTAssertEqual(merged.map(\.text), ["left", "right", "bottom"])
    }

    func testOverlapRatio() {
        let rect = CGRect(x: 0, y: 0, width: 10, height: 10)
        XCTAssertEqual(TextLayout.overlapRatio(of: rect, with: CGRect(x: 5, y: 0, width: 10, height: 10)), 0.5, accuracy: 0.001)
        XCTAssertEqual(TextLayout.overlapRatio(of: rect, with: CGRect(x: 50, y: 50, width: 5, height: 5)), 0)
    }

    func testLinesAreReadFromARealPage() throws {
        let document = TestSupport.makeDocument(pages: [["Hello World", "Second line"]])
        let page = try XCTUnwrap(document.page(at: 0))
        let texts = TextLayout.lines(of: page).map(\.text)
        XCTAssertEqual(texts, ["Hello World", "Second line"])
    }

    func testFontNamesLoseTheirSubsetPrefix() {
        XCTAssertEqual(FontResolver.cleanName("ABCDEF+Helvetica-Bold"), "Helvetica-Bold")
        XCTAssertEqual(FontResolver.cleanName("Helvetica"), "Helvetica")
        XCTAssertEqual(FontResolver.fallbackName(for: "Unknown-BoldItalic"), "Helvetica-BoldOblique")
        XCTAssertEqual(FontResolver.fallbackName(for: "TimesWhatever"), "TimesNewRomanPSMT")
        XCTAssertEqual(FontResolver.fallbackName(for: "SomeMono-Bold"), "Courier-Bold")
    }
}
