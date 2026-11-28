import PDFKit
import UIKit

final class ElementAnnotation: PDFAnnotation {
    let element: EditElement
    let isSelected: Bool

    init(element: EditElement, isSelected: Bool) {
        self.element = element
        self.isSelected = isSelected
        super.init(bounds: element.drawingBounds, forType: .stamp, withProperties: nil)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func draw(with box: PDFDisplayBox, in context: CGContext) {
        ElementRenderer.draw(element, in: context, selected: isSelected)
    }
}
