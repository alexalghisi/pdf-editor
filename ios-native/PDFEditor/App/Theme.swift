import SwiftUI
import UIKit

enum Theme {
    static let background = Color(hex: 0x0B0D12)
    static let canvas = Color(hex: 0x07090D)
    static let surface = Color(hex: 0x12151C)
    static let surfaceRaised = Color(hex: 0x1A1F29)
    static let border = Color(hex: 0x272E3B)
    static let textPrimary = Color(hex: 0xEEF1F6)
    static let textSecondary = Color(hex: 0x9AA4B5)
    static let textInverse = Color(hex: 0x14110A)
    static let accent = Color(hex: 0xFFC53D)
    static let danger = Color(hex: 0xFF6B6B)

    static let touchTarget: CGFloat = 44
    static let contentMaxWidth: CGFloat = 560
    static let swatches: [UInt32] = [0x111111, 0xD92D20, 0x1D4ED8, 0x15803D, 0xFFFFFF]
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }

    var hexValue: UInt32 {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return 0x111111 }
        let r = UInt32((max(0, min(1, red)) * 255).rounded())
        let g = UInt32((max(0, min(1, green)) * 255).rounded())
        let b = UInt32((max(0, min(1, blue)) * 255).rounded())
        return (r << 16) | (g << 8) | b
    }
}
