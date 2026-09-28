import SwiftUI

/** 主题色板 —— 与网页版 Tailwind 配色一致 */
extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    static let slate50 = Color(hex: 0xF8FAFC)
    static let slate100 = Color(hex: 0xF1F5F9)
    static let slate200 = Color(hex: 0xE2E8F0)
    static let slate300 = Color(hex: 0xCBD5E1)
    static let slate400 = Color(hex: 0x94A3B8)
    static let slate500 = Color(hex: 0x64748B)
    static let slate700 = Color(hex: 0x334155)
    static let slate800 = Color(hex: 0x1E293B)

    static let indigo50 = Color(hex: 0xEEF2FF)
    static let indigo100 = Color(hex: 0xE0E7FF)
    static let indigo400 = Color(hex: 0x818CF8)
    static let indigo600 = Color(hex: 0x4F46E5)

    static let amber50 = Color(hex: 0xFFFbeb)
    static let amber100 = Color(hex: 0xFEF3C7)
    static let amber200 = Color(hex: 0xFDE68A)
    static let amber400 = Color(hex: 0xFBBF24)
    static let amber500 = Color(hex: 0xF59E0B)
    static let amber600 = Color(hex: 0xD97706)
    static let amber700 = Color(hex: 0xB45309)

    static let emerald50 = Color(hex: 0xECFDF5)
    static let emerald100 = Color(hex: 0xD1FAE5)
    static let emerald300 = Color(hex: 0x6EE7B7)
    static let emerald500 = Color(hex: 0x10B981)
    static let emerald600 = Color(hex: 0x059669)
    static let emerald700 = Color(hex: 0x047857)

    static let red50 = Color(hex: 0xFEF2F2)
    static let red100 = Color(hex: 0xFEE2E2)
    static let red300 = Color(hex: 0xFCA5A5)
    static let red500 = Color(hex: 0xEF4444)
    static let red600 = Color(hex: 0xDC2626)
}
