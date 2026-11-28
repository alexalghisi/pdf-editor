import PDFKit
import UIKit

struct TextLine: Equatable {
    var text: String
    var bounds: CGRect
    var fontSize: CGFloat
}

struct TextPage: Equatable {
    var size: CGSize
    var lines: [TextLine]
}

struct LineHit {
    var text: String
    var bounds: CGRect
    var fontName: String
    var fontSize: CGFloat
    var colorHex: UInt32
}

enum TextLayout {
    static func lines(of page: PDFPage) -> [TextLine] {
        let box = page.bounds(for: .mediaBox)
        guard let selection = page.selection(for: box) else { return [] }
        return selection.selectionsByLine().compactMap { line in
            let text = (line.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            let bounds = line.bounds(for: page)
            return TextLine(text: text, bounds: bounds, fontSize: max(bounds.height * 0.8, 1))
        }
    }

    static func line(at point: CGPoint, on page: PDFPage) -> LineHit? {
        guard let selection = page.selectionForLine(at: point) else { return nil }
        let text = (selection.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        let bounds = selection.bounds(for: page)
        guard bounds.width > 0, bounds.height > 0, bounds.insetBy(dx: -6, dy: -6).contains(point) else {
            return nil
        }
        var fontName = FontResolver.defaultName
        var fontSize = bounds.height * 0.8
        var colorHex: UInt32 = 0x111111
        if let attributed = selection.attributedString, attributed.length > 0 {
            if let font = attributed.attribute(.font, at: 0, effectiveRange: nil) as? UIFont {
                fontName = font.fontName
                if font.pointSize >= 4, font.pointSize <= bounds.height * 1.4 {
                    fontSize = font.pointSize
                }
            }
            if let color = attributed.attribute(.foregroundColor, at: 0, effectiveRange: nil) as? UIColor {
                colorHex = color.hexValue
            }
        }
        return LineHit(text: text, bounds: bounds, fontName: fontName, fontSize: fontSize, colorHex: colorHex)
    }

    static func merge(lines: [TextLine], elements: [EditElement]) -> [TextLine] {
        let covered = elements.compactMap { $0.coveredBounds }
        var result = lines.filter { line in
            !covered.contains { overlapRatio(of: line.bounds, with: $0) > 0.5 }
        }
        for element in elements where element.isText {
            let text = element.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            result.append(TextLine(text: text, bounds: element.frame, fontSize: element.fontSize))
        }
        return result.sorted { first, second in
            if abs(first.bounds.midY - second.bounds.midY) > 2 {
                return first.bounds.midY > second.bounds.midY
            }
            return first.bounds.minX < second.bounds.minX
        }
    }

    static func overlapRatio(of rect: CGRect, with other: CGRect) -> CGFloat {
        let area = rect.width * rect.height
        guard area > 0 else { return 0 }
        let intersection = rect.intersection(other)
        guard !intersection.isNull else { return 0 }
        return (intersection.width * intersection.height) / area
    }
}
