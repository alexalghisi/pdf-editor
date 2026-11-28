import UIKit

enum ElementRenderer {
    static func draw(_ element: EditElement, in context: CGContext, selected: Bool) {
        context.saveGState()
        if let covered = element.coveredBounds {
            context.setFillColor(UIColor.white.cgColor)
            context.fill(covered.insetBy(dx: -1, dy: -1))
        }
        switch element.kind {
        case let .image(data):
            if let image = UIImage(data: data)?.cgImage {
                context.draw(image, in: element.frame)
            }
        case .replacement, .addedText:
            drawText(element, in: context)
        }
        if selected {
            context.setStrokeColor(UIColor(hex: 0xFFC53D).cgColor)
            context.setLineWidth(1)
            context.setLineDash(phase: 0, lengths: [4, 3])
            context.stroke(element.frame.insetBy(dx: -3, dy: -3))
        }
        context.restoreGState()
    }

    private static func drawText(_ element: EditElement, in context: CGContext) {
        guard !element.text.isEmpty else { return }
        let font = FontResolver.font(named: element.fontName, size: element.fontSize)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: UIColor(hex: element.colorHex),
        ]
        context.saveGState()
        context.translateBy(x: element.frame.minX, y: element.frame.minY + font.lineHeight)
        context.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(context)
        (element.text as NSString).draw(at: .zero, withAttributes: attributes)
        UIGraphicsPopContext()
        context.restoreGState()
    }
}
