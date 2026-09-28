import Foundation

/// mulberry32 可播种随机源 —— 与网页版 bank.ts 逐位一致。
/// JS 的 Int32 环绕/位运算用 UInt32 的 &+ &* 精确复刻（位模式相同）。
final class Mulberry32 {
    private var a: UInt32

    init(seed: Int) {
        a = UInt32(truncatingIfNeeded: seed)
    }

    func next() -> Double {
        a = a &+ 0x6D2B79F5
        var t = a
        t = (t ^ (t >> 15)) &* (1 | t)
        let x = (t ^ (t >> 7)) &* (61 | t)
        t = (t &+ x) ^ t
        return Double(t ^ (t >> 14)) / 4294967296.0
    }
}
