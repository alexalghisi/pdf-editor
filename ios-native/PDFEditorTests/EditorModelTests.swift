import PDFKit
import XCTest
@testable import PDFEditor

final class EditorModelTests: XCTestCase {
    private func lineCentre(_ text: String, in model: EditorModel) throws -> (CGPoint, PDFPage) {
        let page = try XCTUnwrap(model.document.page(at: 0))
        let line = try XCTUnwrap(TextLayout.lines(of: page).first { $0.text == text })
        return (CGPoint(x: line.bounds.midX, y: line.bounds.midY), page)
    }

    func testTappingALineOpensItForEditing() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Hello World", in: model)
        model.handleTap(at: point, on: page)
        XCTAssertTrue(model.isEditing)
        XCTAssertEqual(model.editingText, "Hello World")
    }

    func testCommittingAnUnchangedLineLeavesNoTrace() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Hello World", in: model)
        model.handleTap(at: point, on: page)
        model.commitEditing()
        XCTAssertTrue(model.elements.isEmpty)
        XCTAssertFalse(model.canUndo)
        XCTAssertFalse(model.hasChanges)
    }

    func testEditingALineCanBeUndoneAndRedone() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Hello World", in: model)
        model.handleTap(at: point, on: page)
        model.updateEditingText("Goodbye")
        model.commitEditing()
        XCTAssertEqual(model.elements.map(\.text), ["Goodbye"])
        XCTAssertTrue(model.hasChanges)

        model.undo()
        XCTAssertTrue(model.elements.isEmpty)
        model.redo()
        XCTAssertEqual(model.elements.map(\.text), ["Goodbye"])
    }

    func testCancellingRestoresTheLine() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Hello World", in: model)
        model.handleTap(at: point, on: page)
        model.updateEditingText("Changed")
        model.cancelEditing()
        XCTAssertTrue(model.elements.isEmpty)
        XCTAssertFalse(model.isEditing)
    }

    func testEditedTextReachesTheTextExport() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Hello World", in: model)
        model.handleTap(at: point, on: page)
        model.updateEditingText("Goodbye")
        model.commitEditing()
        XCTAssertEqual(Exporters.text(model.textPages()), "Goodbye\nSecond line")
    }

    func testAddedTextIsWrittenIntoTheSavedPdf() throws {
        let model = TestSupport.makeModel()
        model.addText()
        model.updateEditingText("Inserted natively")
        model.commitEditing()

        let saved = try XCTUnwrap(PDFDocument(data: model.exportPDF()))
        XCTAssertEqual(saved.pageCount, 1)
        let text = saved.page(at: 0)?.string ?? ""
        XCTAssertTrue(text.contains("Inserted natively"), text)
        XCTAssertTrue(text.contains("Second line"), text)
    }

    func testEmptyAddedTextIsDiscarded() {
        let model = TestSupport.makeModel()
        model.addText()
        model.updateEditingText("  ")
        model.commitEditing()
        XCTAssertTrue(model.elements.isEmpty)
        XCTAssertFalse(model.canUndo)
    }

    func testDeletingAReplacedLineHidesItAndASecondDeleteRestoresIt() throws {
        let model = TestSupport.makeModel()
        let (point, page) = try lineCentre("Second line", in: model)
        model.handleTap(at: point, on: page)
        model.updateEditingText("Edited")
        model.commitEditing()
        model.deleteSelected()
        XCTAssertEqual(model.elements.map(\.text), [""])
        XCTAssertEqual(Exporters.text(model.textPages()), "Hello World")

        model.select(model.elements.first?.id)
        model.deleteSelected()
        XCTAssertTrue(model.elements.isEmpty)
    }

    func testScalingAndColouringTheSelection() {
        let model = TestSupport.makeModel()
        model.addText()
        model.commitEditing()
        let before = model.elements[0]
        model.scaleSelected(by: 2)
        model.setSelectedColor(0xD92D20)
        XCTAssertEqual(model.elements[0].fontSize, before.fontSize * 2)
        XCTAssertGreaterThan(model.elements[0].frame.width, before.frame.width)
        XCTAssertEqual(model.elements[0].colorHex, 0xD92D20)
        model.undo()
        model.undo()
        XCTAssertEqual(model.elements[0], before)
    }

    func testMovingAnElement() throws {
        let model = TestSupport.makeModel()
        model.addText()
        model.commitEditing()
        let page = try XCTUnwrap(model.document.page(at: 0))
        let start = model.elements[0].frame
        XCTAssertTrue(model.beginMove(at: CGPoint(x: start.midX, y: start.midY), on: page))
        model.move(by: CGSize(width: 30, height: -20))
        model.endMove()
        XCTAssertEqual(model.elements[0].frame.origin.x, start.origin.x + 30, accuracy: 0.001)
        XCTAssertEqual(model.elements[0].frame.origin.y, start.origin.y - 20, accuracy: 0.001)
        model.undo()
        XCTAssertEqual(model.elements[0].frame, start)
    }

    func testRotatingAPage() {
        let model = TestSupport.makeModel()
        model.rotateCurrentPage()
        XCTAssertEqual(model.document.page(at: 0)?.rotation, 90)
        model.undo()
        XCTAssertEqual(model.document.page(at: 0)?.rotation, 0)
        model.redo()
        XCTAssertEqual(model.document.page(at: 0)?.rotation, 90)
    }

    func testDeletingAPageMovesLaterElementsAndCanBeUndone() {
        let model = TestSupport.makeModel(pages: [["First"], ["Second"], ["Third"]])
        model.currentPageIndex = 2
        model.addText()
        model.commitEditing()
        model.currentPageIndex = 0
        model.deleteCurrentPage()
        XCTAssertEqual(model.pageCount, 2)
        XCTAssertEqual(model.elements.map(\.pageIndex), [1])

        model.undo()
        XCTAssertEqual(model.pageCount, 3)
        XCTAssertEqual(model.elements.map(\.pageIndex), [2])
        XCTAssertEqual(model.document.page(at: 0)?.string?.contains("First"), true)
    }

    func testTheLastPageCannotBeDeleted() {
        let model = TestSupport.makeModel()
        model.deleteCurrentPage()
        XCTAssertEqual(model.pageCount, 1)
        XCTAssertFalse(model.canUndo)
    }

    func testExportsEveryFormatToAFile() throws {
        let model = TestSupport.makeModel()
        for format in ExportFormat.allCases {
            let file = try model.export(format)
            XCTAssertEqual(file.url.pathExtension, format.fileExtension)
            XCTAssertEqual(file.url.deletingPathExtension().lastPathComponent, "Test")
            let size = try XCTUnwrap(try file.url.resourceValues(forKeys: [.fileSizeKey]).fileSize)
            XCTAssertGreaterThan(size, 0)
        }
    }

    func testRotatedPagesKeepTheirOrientationWhenSaved() throws {
        let model = TestSupport.makeModel()
        model.rotateCurrentPage()
        let saved = try XCTUnwrap(PDFDocument(data: model.exportPDF()))
        let box = try XCTUnwrap(saved.page(at: 0)).bounds(for: .mediaBox)
        XCTAssertEqual(box.width, TestSupport.pageSize.height, accuracy: 1)
        XCTAssertEqual(box.height, TestSupport.pageSize.width, accuracy: 1)
    }
}
