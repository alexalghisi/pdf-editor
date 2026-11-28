import CoreGraphics
import Foundation

struct EditElement: Identifiable, Equatable {
    enum Kind: Equatable {
        case replacement(originalBounds: CGRect, originalText: String)
        case addedText
        case image(Data)
    }

    let id: UUID
    var pageIndex: Int
    var kind: Kind
    var frame: CGRect
    var text: String
    var fontName: String
    var fontSize: CGFloat
    var colorHex: UInt32

    var isText: Bool {
        if case .image = kind { return false }
        return true
    }

    var coveredBounds: CGRect? {
        if case let .replacement(originalBounds, _) = kind { return originalBounds }
        return nil
    }

    var drawingBounds: CGRect {
        let base = coveredBounds.map { frame.union($0) } ?? frame
        return base.insetBy(dx: -6, dy: -6)
    }
}
