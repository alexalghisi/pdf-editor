import PDFKit
import UIKit
@testable import PDFEditor

enum TestSupport {
    static let pageSize = CGSize(width: 400, height: 300)

    static func makeDocument(pages: [[String]]) -> PDFDocument {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize))
        let data = renderer.pdfData { context in
            for lines in pages {
                context.beginPage()
                for (index, line) in lines.enumerated() {
                    (line as NSString).draw(
                        at: CGPoint(x: 40, y: 40 + CGFloat(index) * 40),
                        withAttributes: [.font: UIFont(name: "Helvetica", size: 18) ?? UIFont.systemFont(ofSize: 18)]
                    )
                }
            }
        }
        return PDFDocument(data: data) ?? PDFDocument()
    }

    static func makeModel(pages: [[String]] = [["Hello World", "Second line"]]) -> EditorModel {
        EditorModel(document: makeDocument(pages: pages), title: "Test.pdf")
    }

    static func element(
        text: String,
        frame: CGRect,
        kind: EditElement.Kind = .addedText,
        pageIndex: Int = 0
    ) -> EditElement {
        EditElement(
            id: UUID(),
            pageIndex: pageIndex,
            kind: kind,
            frame: frame,
            text: text,
            fontName: "Helvetica",
            fontSize: 12,
            colorHex: 0x111111
        )
    }
}
