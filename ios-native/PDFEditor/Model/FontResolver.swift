import UIKit

enum FontResolver {
    static let defaultName = "Helvetica"

    static func cleanName(_ name: String) -> String {
        guard let plus = name.firstIndex(of: "+") else { return name }
        let prefix = name[name.startIndex..<plus]
        guard prefix.count == 6, prefix.allSatisfy({ $0.isLetter && $0.isUppercase }) else { return name }
        return String(name[name.index(after: plus)...])
    }

    static func isBold(_ name: String) -> Bool {
        let lower = name.lowercased()
        return lower.contains("bold") || lower.contains("black") || lower.contains("heavy")
    }

    static func toggledBold(_ name: String) -> String {
        let cleaned = cleanName(name)
        guard isBold(cleaned) else { return fallbackName(for: cleaned + "-Bold") }
        var stripped = cleaned
        for token in ["SemiBold", "Semibold", "Bold", "bold", "Black", "Heavy"] {
            stripped = stripped.replacingOccurrences(of: token, with: "")
        }
        return fallbackName(for: stripped)
    }

    static func fallbackName(for name: String) -> String {
        let lower = name.lowercased()
        let bold = lower.contains("bold") || lower.contains("black") || lower.contains("heavy")
        let italic = lower.contains("italic") || lower.contains("oblique")
        if lower.contains("courier") || lower.contains("mono") {
            switch (bold, italic) {
            case (true, true): return "Courier-BoldOblique"
            case (true, false): return "Courier-Bold"
            case (false, true): return "Courier-Oblique"
            case (false, false): return "Courier"
            }
        }
        if lower.contains("times") || lower.contains("serif") || lower.contains("georgia") {
            switch (bold, italic) {
            case (true, true): return "TimesNewRomanPS-BoldItalicMT"
            case (true, false): return "TimesNewRomanPS-BoldMT"
            case (false, true): return "TimesNewRomanPS-ItalicMT"
            case (false, false): return "TimesNewRomanPSMT"
            }
        }
        switch (bold, italic) {
        case (true, true): return "Helvetica-BoldOblique"
        case (true, false): return "Helvetica-Bold"
        case (false, true): return "Helvetica-Oblique"
        case (false, false): return "Helvetica"
        }
    }

    static func font(named name: String, size: CGFloat) -> UIFont {
        let pointSize = max(size, 1)
        let cleaned = cleanName(name)
        if let exact = UIFont(name: cleaned, size: pointSize) { return exact }
        if let fallback = UIFont(name: fallbackName(for: cleaned), size: pointSize) { return fallback }
        return UIFont.systemFont(ofSize: pointSize)
    }

    static func width(of text: String, fontName: String, fontSize: CGFloat) -> CGFloat {
        let font = font(named: fontName, size: fontSize)
        let measured = (text as NSString).size(withAttributes: [.font: font]).width
        return ceil(measured)
    }
}
