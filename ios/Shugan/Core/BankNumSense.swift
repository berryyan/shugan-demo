import Foundation

/**
 * 五年级 5.0 数感地基 · 因数与倍数 —— 与 bank.ts 逐行对应。
 * 因数枚举 / 整除特征 / 质数与合数 / 最大公因数 / 最小公倍数
 * 2026-10-13 新增（用户拍板）。难度封顶：N ≤ 100、分解质因数质因子 ≤ 4 个。
 */

/** N 的因数列表（升序） */
func factorsOf(_ n: Int) -> [Int] {
    var out: [Int] = []
    for i in 1...n where n % i == 0 { out.append(i) }
    return out
}

/** 末两位补零文本：5 → "05" */
func pad2(_ x: Int) -> String { String(format: "%02d", x) }

/** 质数判断 */
func isPrimeNum(_ n: Int) -> Bool {
    if n < 2 { return false }
    var p = 2
    while p * p <= n {
        if n % p == 0 { return false }
        p += 1
    }
    return true
}

/** 最小质因数 */
func smallestPrimeFactor(_ n: Int) -> Int {
    var p = 2
    while n % p != 0 { p += 1 }
    return p
}

/** 分解质因数 → [(质因子, 指数)]（升序） */
func factorize(_ n: Int) -> [(Int, Int)] {
    var out: [(Int, Int)] = []
    var x = n
    var p = 2
    while p * p <= x {
        if x % p == 0 {
            var e = 0
            while x % p == 0 {
                x /= p
                e += 1
            }
            out.append((p, e))
        }
        p += 1
    }
    if x > 1 { out.append((x, 1)) }
    return out
}

/** 质因子列表（含重数，升序）：12 → [2, 2, 3] */
func factorList(_ n: Int) -> [Int] {
    var out: [Int] = []
    for (p, e) in factorize(n) { for _ in 0..<e { out.append(p) } }
    return out
}

/** 因子列表 → 标准分解文本：[2, 2, 3] → 2²×3 */
func factorListText(_ list: [Int]) -> String {
    var parts: [String] = []
    var i = 0
    while i < list.count {
        var j = i
        while j < list.count && list[j] == list[i] { j += 1 }
        parts.append(j - i == 1 ? String(list[i]) : "\(list[i])\(sup(j - i))")
        i = j
    }
    return parts.joined(separator: "×")
}

/** 分解质因数标准文本：12 → 2²×3 */
func factorText(_ n: Int) -> String { factorListText(factorList(n)) }

/** 因数枚举宿主数：≤100、因数总数 ≥5（即非平凡因数 ≥3 个）的合数 */
let FACTOR_HOSTS: [Int] = (4...100).filter { factorsOf($0).count >= 5 }

/** 互质乘数对（都 ≥2 且互质）：构造"有公因数 g 但非倍数关系"的数对 */
let COP_MULT: [(Int, Int)] = [(2, 3), (2, 5), (3, 4), (3, 5), (4, 5)]

/** 互质数对（两数 ≤ 50，混合 质+合 / 合+合 / 相邻数） */
let COP_PAIRS: [(Int, Int)] = [
    (4, 9), (8, 9), (4, 15), (9, 10), (6, 35), (8, 15), (9, 20), (14, 15), (21, 22), (25, 26),
    (12, 35), (7, 12), (8, 21), (9, 25), (10, 21), (4, 25), (6, 25), (27, 28), (33, 35), (20, 21),
    (7, 9), (8, 27), (13, 14), (16, 25), (24, 25),
]

/** 互质数对（乘积 ≤ 100，供最小公倍数"互质直接乘"题型） */
let COP_PAIRS_SMALL: [(Int, Int)] = [
    (2, 3), (2, 5), (2, 7), (2, 9), (3, 4), (3, 5), (3, 7), (3, 8), (3, 10), (4, 5),
    (4, 7), (4, 9), (5, 6), (5, 7), (5, 8), (5, 9), (6, 7), (7, 8), (7, 9), (8, 9),
    (2, 11), (3, 11), (4, 11), (7, 10), (9, 10), (5, 11), (8, 11), (9, 11),
]

/** 有公因数但非倍数关系的数对（最小公倍数 ≤ 100） */
let LCM_PAIRS: [(Int, Int)] = [
    (4, 6), (6, 8), (6, 9), (6, 10), (8, 10), (8, 12), (9, 12), (10, 12), (10, 15), (12, 14),
    (12, 15), (12, 16), (12, 18), (14, 21), (15, 20), (10, 14), (8, 14), (9, 15), (16, 20), (15, 25),
    (20, 25), (12, 20), (16, 24), (18, 27), (20, 30), (6, 15), (4, 10), (4, 14), (6, 14),
]

/** 因数枚举（数感地基 1/5）：选因数 40% / 选非因数 25% / 因数个数 20% / 因数配对 15% */
func genFactorSense(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    let N = pick(rng, FACTOR_HOSTS)
    let factors = factorsOf(N)
    let nontrivial = factors.filter { $0 > 1 && $0 < N }
    if kind < 0.4 {
        // 选出 N 的因数：干扰项 = 邻近但不能整除的数
        let c = pick(rng, nontrivial)
        var traps: [Trap] = []
        var dt = 1
        while traps.count < 3 && dt <= 10 {
            for t in [c - dt, c + dt] {
                if traps.count >= 3 { break }
                if t <= 1 || t >= N || N % t == 0 { continue }
                traps.append((value: text("\(t)"), trap: "\(N) ÷ \(t) 有余数，\(t) 不是 \(N) 的因数"))
            }
            dt += 1
        }
        return makeQuestion(rng: rng, prompt: text("\(N) 的因数"), requirement: "下面哪个是？", correct: text(c), traps: traps)
    }
    if kind < 0.65 {
        // 选出不是 N 的因数：干扰项 = 3 个真因数
        var non: [Int] = []
        for t in 2..<N where N % t != 0 { non.append(t) }
        let c = pick(rng, non)
        var traps: [Trap] = []
        var used = Set<Int>()
        while traps.count < 3 {
            let f = pick(rng, nontrivial)
            if used.contains(f) { continue }
            used.insert(f)
            traps.append((value: text("\(f)"), trap: "\(f) 是 \(N) 的因数（\(N) ÷ \(f) = \(N / f)）"))
        }
        return makeQuestion(rng: rng, prompt: text("\(N) 的因数"), requirement: "下面哪个不是？", correct: text(c), traps: traps)
    }
    if kind < 0.85 {
        // 因数个数：只出因数总数 5~9 的数（太多没有秒答价值）
        var N2 = N
        var tries = 0
        while tries < 50 && factorsOf(N2).count > 9 {
            N2 = pick(rng, FACTOR_HOSTS)
            tries += 1
        }
        let tau = factorsOf(N2).count
        var traps: [Trap] = []
        pushTextTrap(&traps, (tau - 2) * 10, "漏数了 1 和它自己", tau * 10)
        pushTextTrap(&traps, (tau - 1) * 10, "漏了一对——因数都是成对出现的", tau * 10)
        pushTextTrap(&traps, (tau + 1) * 10, "多数了一个，再核对一遍", tau * 10)
        return makeQuestion(rng: rng, prompt: text("\(N2)"), requirement: "它的因数有几个？", correct: text(tau), traps: traps)
    }
    // 因数配对：N = a ×（ ）
    let a = pick(rng, nontrivial)
    let b = N / a
    var traps: [Trap] = []
    for t in [b + 1, b - 1, b + 2, b - 2, b + 3] {
        if traps.count >= 3 { break }
        if t <= 0 || t == b { continue }
        traps.append((value: text("\(t)"), trap: "\(a) × \(t) = \(a * t)，不是 \(N)"))
    }
    return makeQuestion(rng: rng, prompt: text("\(N) = \(a) ×（ ）"), requirement: "括号里填几？", correct: text(b), traps: traps)
}

/** 整除特征（数感地基 2/5）：3/9 数字和 55%、2/5 个位 20%、6/10 双条件 15%、4/25 末两位 10% */
func genDivisSense(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    if kind < 0.55 {
        // 数字和规则：3（30%）或 9（25%）
        let m = kind < 0.3 ? 3 : 9
        let len = rng.next() < 0.5 ? 3 : 4
        var prefix = 1 + Int(rng.next() * 9)
        for _ in 0..<(len - 2) { prefix = prefix * 10 + Int(rng.next() * 10) }
        var S = 0
        for ch in String(prefix) { S += Int(String(ch))! }
        let rc = (m - (S % m)) % m // 末位需要满足的 mod m 余数
        var okDigits: [Int] = []
        var badDigits: [Int] = []
        for d in 0...9 {
            if d % m == rc { okDigits.append(d) } else { badDigits.append(d) }
        }
        let last = pick(rng, okDigits)
        let N = prefix * 10 + last
        var traps: [Trap] = []
        var used = Set<Int>()
        while traps.count < 3 {
            let w = pick(rng, badDigits)
            if used.contains(w) { continue }
            used.insert(w)
            traps.append((value: text("\(prefix * 10 + w)"), trap: "数字和是 \(S + w)，不能被 \(m) 整除"))
        }
        return makeQuestion(rng: rng, prompt: text("下面哪个数能被 \(m) 整除？"), requirement: "整除判断（算数字和）", correct: text(N), traps: traps)
    }
    if kind < 0.75 {
        // 个位规则：2 或 5
        let m = rng.next() < 0.5 ? 2 : 5
        let valid = m == 2 ? [0, 2, 4, 6, 8] : [0, 5]
        let validText = m == 2 ? "0、2、4、6、8" : "0 或 5"
        let prefix = 10 + Int(rng.next() * 989) // 10~998
        let last = pick(rng, valid)
        let N = prefix * 10 + last
        var traps: [Trap] = []
        var used = Set(valid)
        while traps.count < 3 {
            let w = Int(rng.next() * 10)
            if used.contains(w) { continue }
            used.insert(w)
            traps.append((value: text("\(prefix * 10 + w)"), trap: "被 \(m) 整除的数，个位只能是 \(validText)"))
        }
        return makeQuestion(rng: rng, prompt: text("下面哪个数能被 \(m) 整除？"), requirement: "整除判断（看个位）", correct: text(N), traps: traps)
    }
    if kind < 0.9 {
        // 双条件：6（偶数 + 数字和能被 3 整除）或 10（个位 0）
        if rng.next() < 0.5 {
            let prefix = 10 + Int(rng.next() * 989)
            let N = prefix * 10
            var traps: [Trap] = [
                (value: text("\(prefix * 10 + 5)"), trap: "个位是 5 只能被 5 整除，10 的倍数个位必须是 0"),
            ]
            var used: Set<Int> = [0, 5]
            while traps.count < 3 {
                let w = 1 + Int(rng.next() * 9)
                if used.contains(w) { continue }
                used.insert(w)
                traps.append((value: text("\(prefix * 10 + w)"), trap: "10 的倍数个位必须是 0"))
            }
            return makeQuestion(rng: rng, prompt: text("下面哪个数能被 10 整除？"), requirement: "整除判断", correct: text(N), traps: traps)
        }
        // 6
        var prefix = 1 + Int(rng.next() * 9)
        prefix = prefix * 10 + Int(rng.next() * 10) // 前两位
        var S = 0
        for ch in String(prefix) { S += Int(String(ch))! }
        let rc = (3 - (S % 3)) % 3
        var okEven: [Int] = [] // 偶数且余数对 → 正确答案
        var oddOk: [Int] = [] // 奇数但数字和对 → 陷阱 a
        var evenBad: [Int] = [] // 偶数但数字和不对 → 陷阱 b
        var oddBad: [Int] = [] // 奇数且不对 → 陷阱 c
        for d in 0...9 {
            let even = d % 2 == 0
            let ok = d % 3 == rc
            if even && ok { okEven.append(d) }
            else if !even && ok { oddOk.append(d) }
            else if even { evenBad.append(d) }
            else { oddBad.append(d) }
        }
        let last = pick(rng, okEven)
        let N = prefix * 10 + last
        let w1 = pick(rng, oddOk)
        let w2 = pick(rng, evenBad)
        let w3 = pick(rng, oddBad)
        let traps: [Trap] = [
            (value: text("\(prefix * 10 + w1)"), trap: "数字和能被 3 整除，但它是奇数——6 的倍数必须是偶数"),
            (value: text("\(prefix * 10 + w2)"), trap: "是偶数，但数字和不能被 3 整除"),
            (value: text("\(prefix * 10 + w3)"), trap: "既不是偶数，数字和也不能被 3 整除"),
        ]
        return makeQuestion(rng: rng, prompt: text("下面哪个数能被 6 整除？"), requirement: "整除判断（两个条件都要满足）", correct: text(N), traps: traps)
    }
    // 末两位规则：4 或 25
    if rng.next() < 0.5 {
        let prefix = 1 + Int(rng.next() * 98)
        let e = Int(rng.next() * 25) * 4
        let N = prefix * 100 + e
        var traps: [Trap] = []
        for dt in [2, 6, 10] {
            let w = (e + dt) % 100
            traps.append((value: text("\(prefix * 100 + w)"), trap: "末两位 \(pad2(w)) 除以 4 有余数，被 4 整除要看末两位"))
        }
        return makeQuestion(rng: rng, prompt: text("下面哪个数能被 4 整除？"), requirement: "整除判断（看末两位）", correct: text(N), traps: traps)
    }
    let prefix = 1 + Int(rng.next() * 98)
    let e = pick(rng, [0, 25, 50, 75])
    let N = prefix * 100 + e
    let pool = [5, 15, 20, 35, 45, 65, 85, 95]
    var traps: [Trap] = []
    var used = Set<Int>()
    while traps.count < 3 {
        let w = pick(rng, pool)
        if used.contains(w) { continue }
        used.insert(w)
        traps.append((value: text("\(prefix * 100 + w)"), trap: "末两位 \(pad2(w)) 不行——被 25 整除末两位只能是 00、25、50、75"))
    }
    return makeQuestion(rng: rng, prompt: text("下面哪个数能被 25 整除？"), requirement: "整除判断（看末两位）", correct: text(N), traps: traps)
}

/** 100 以内质数 */
let PRIMES_100: [Int] = (2...100).filter { isPrimeNum($0) }

/** 看着像质数的合数（经典伪装者：51=3×17、57=3×19、91=7×13 等） */
let PSEUDO_PRIMES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93, 95, 99]

/** 分解质因数宿主：4~100 的合数，质因子（按重数计）≤ 4 个 */
let FACTORIZE_HOSTS: [Int] = (4...100).filter { !isPrimeNum($0) && factorList($0).count <= 4 }

/** 质数与合数（数感地基 3/5）：辨质数 35% / 分解质因数 45% / 质因数个数与最小质因数 20% */
func genPrimeSense(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    if kind < 0.35 {
        // 辨质数
        let c = pick(rng, PRIMES_100)
        var traps: [Trap] = []
        if rng.next() < 0.2 { traps.append((value: text("1"), trap: "1 既不是质数也不是合数")) }
        var used = Set<Int>()
        while traps.count < 3 {
            let t = pick(rng, PSEUDO_PRIMES)
            if used.contains(t) { continue }
            used.insert(t)
            let sp = smallestPrimeFactor(t)
            traps.append((value: text("\(t)"), trap: "\(t) = \(sp) × \(t / sp)，是合数"))
        }
        return makeQuestion(rng: rng, prompt: text("下面哪个是质数？"), requirement: "判断", correct: text(c), traps: traps)
    }
    if kind < 0.8 {
        // 分解质因数：选标准写法
        let N = pick(rng, FACTORIZE_HOSTS)
        let list = factorList(N)
        let correct = factorText(N)
        var traps: [Trap] = []
        if list.count >= 3 {
            // 未分完：合并前两个因子（如 12 = 4×3）
            let merged = list[0] * list[1]
            traps.append((
                value: text(factorListText([merged] + Array(list.dropFirst(2)))),
                trap: "\(merged) 不是质数，要分解到每个数都是质数"
            ))
        } else {
            traps.append((value: text("1×\(correct)"), trap: "1 不是质数，分解质因数不能写 1"))
        }
        // 少乘一个：去掉最后一个因子
        let prod1 = N / list[list.count - 1]
        traps.append((value: text(factorListText(Array(list.dropLast()))), trap: "乘积只有 \(prod1)，少乘了一个质因数"))
        // 乘积错：最小因子 +1
        let listW = ([list[0] + 1] + Array(list.dropFirst())).sorted()
        var prodW = 1
        for f in listW { prodW *= f }
        traps.append((value: text(factorListText(listW)), trap: "乘积是 \(prodW)，不是 \(N)"))
        return makeQuestion(rng: rng, prompt: text("把 \(N) 分解质因数"), requirement: "选出标准写法", correct: text(correct), traps: traps)
    }
    if rng.next() < 0.5 {
        // 不同质因数个数（只出 ≥2 个质因子的合数）
        var N = pick(rng, FACTORIZE_HOSTS)
        var tries = 0
        while tries < 50 && factorize(N).count < 2 {
            N = pick(rng, FACTORIZE_HOSTS)
            tries += 1
        }
        let cnt = factorize(N).count
        let total = factorList(N).count
        var traps: [Trap] = []
        pushTextTrap(&traps, total * 10, "相同的质因数只算一个，不能重复计数", cnt * 10)
        pushTextTrap(&traps, (cnt - 1) * 10, "漏数了一个质因数", cnt * 10)
        pushTextTrap(&traps, (cnt + 1) * 10, "多算了一个，相同的质因数只算一次", cnt * 10)
        fillTextTraps(&traps, cnt * 10)
        return makeQuestion(rng: rng, prompt: text("\(N)"), requirement: "它的不同质因数有几个？", correct: text(cnt), traps: traps)
    }
    // 最小质因数
    let N = pick(rng, FACTORIZE_HOSTS)
    let primes = factorize(N).map { $0.0 }
    let spf = primes[0]
    var traps: [Trap] = []
    if primes.count > 1 {
        pushTextTrap(&traps, primes[primes.count - 1] * 10, "那是 \(N) 的质因数，但不是最小的", spf * 10)
    }
    pushTextTrap(&traps, 10, "1 不是质数", spf * 10)
    pushTextTrap(
        &traps,
        (spf + 1) * 10,
        N % (spf + 1) == 0 ? "\(spf + 1) 是 \(N) 的质因数，但不是最小的" : "\(spf + 1) 不能整除 \(N)",
        spf * 10
    )
    fillTextTraps(&traps, spf * 10)
    return makeQuestion(rng: rng, prompt: text("\(N)"), requirement: "它的最小质因数是？", correct: text(spf), traps: traps)
}

/** 最大公因数（数感地基 4/5）：倍数关系 30% / 常见小数字对 30% / 互质对 20% / 稍大常见对 20% */
func genGcdSense(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    if kind < 0.3 {
        // 倍数关系：答案是小数本身
        let a = 3 + Int(rng.next() * 10) // 3~12
        let k = 2 + Int(rng.next() * 7) // 2~8
        let b = a * k
        var traps: [Trap] = []
        pushTextTrap(&traps, b * 10, "那是最小公倍数！倍数关系中，最大公因数是较小的数本身", a * 10)
        pushTextTrap(&traps, 10, "1 是所有数的公因数，但它们有更大的", a * 10)
        pushTextTrap(&traps, (a + 1) * 10, "\(a + 1) 不能整除 \(a)", a * 10)
        return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最大公因数是？", correct: text(a), traps: traps)
    }
    if kind < 0.6 {
        // 常见小数字对：g∈2~9 × 互质乘数对，两数 ≤ 50
        var g = 2
        var a = 4
        var b = 6
        for _ in 0..<50 {
            let tg = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9])
            let (x, y) = pick(rng, COP_MULT)
            if tg * y <= 50 {
                g = tg
                a = tg * x
                b = tg * y
                break
            }
        }
        var traps: [Trap] = []
        for d in 2..<g where g % d == 0 {
            pushTextTrap(&traps, d * 10, "\(d) 也是公因数，但不是最大的", g * 10)
        }
        pushTextTrap(&traps, 10, "1 是公因数，但 \(a) 和 \(b) 都能被 \(g) 整除", g * 10)
        pushTextTrap(&traps, (b - a) * 10, "两数之差不是最大公因数", g * 10)
        pushTextTrap(&traps, (g + 1) * 10, "\(g + 1) 不能同时整除 \(a) 和 \(b)", g * 10)
        fillTextTraps(&traps, g * 10)
        return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最大公因数是？", correct: text(g), traps: traps)
    }
    if kind < 0.8 {
        // 互质对：答案是 1
        let (a, b) = pick(rng, COP_PAIRS)
        var traps: [Trap] = []
        pushTextTrap(&traps, min(a, b) * 10, "较小数整除不了较大数——它们互质，最大公因数就是 1", 10)
        pushTextTrap(&traps, smallestPrimeFactor(a) * 10, "\(smallestPrimeFactor(a)) 能整除 \(a)，但整除不了 \(b)", 10)
        pushTextTrap(&traps, smallestPrimeFactor(b) * 10, "\(smallestPrimeFactor(b)) 能整除 \(b)，但整除不了 \(a)", 10)
        fillTextTraps(&traps, 10)
        return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最大公因数是？", correct: text(1), traps: traps)
    }
    // 稍大常见对：g ∈ {6,8,9,10,12,15,20,25} × 互质乘数对，两数 ≤ 100
    var g = 6
    var a = 12
    var b = 18
    for _ in 0..<50 {
        let tg = pick(rng, [6, 8, 9, 10, 12, 15, 20, 25])
        let (x, y) = pick(rng, COP_MULT)
        if tg * y <= 100 {
            g = tg
            a = tg * x
            b = tg * y
            break
        }
    }
    let L = a * b / g
    var traps: [Trap] = []
    if L <= 200 { pushTextTrap(&traps, L * 10, "那是公倍数，不是公因数！问的是最大公因数", g * 10) }
    pushTextTrap(&traps, (g / smallestPrimeFactor(g)) * 10, "\(g / smallestPrimeFactor(g)) 是公因数，但不是最大的", g * 10)
    pushTextTrap(&traps, 10, "它们都能被 \(g) 整除，1 不是最大的", g * 10)
    fillTextTraps(&traps, g * 10)
    return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最大公因数是？", correct: text(g), traps: traps)
}

/** 最小公倍数（数感地基 5/5）：倍数关系 30% / 互质对 30% / 有公因数对 40% */
func genLcmSense(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    if kind < 0.3 {
        // 倍数关系：答案是大数本身
        let a = 3 + Int(rng.next() * 10) // 3~12
        let k = 2 + Int(rng.next() * 7) // 2~8
        let b = a * k
        var traps: [Trap] = []
        pushTextTrap(&traps, a * b * 10, "倍数关系不用乘！大数本身就是最小公倍数", b * 10)
        pushTextTrap(&traps, a * 10, "那是最大公因数，不是公倍数", b * 10)
        pushTextTrap(&traps, b * 2 * 10, "是公倍数，但不是最小的", b * 10)
        return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最小公倍数是？", correct: text(b), traps: traps)
    }
    if kind < 0.6 {
        // 互质对：答案是乘积
        let (a, b) = pick(rng, COP_PAIRS_SMALL)
        let P = a * b
        var traps: [Trap] = []
        pushTextTrap(&traps, max(a, b) * 10, "互质的两个数，最小公倍数是它们的乘积", P * 10)
        pushTextTrap(&traps, (a + b) * 10, "公倍数不是把两数相加", P * 10)
        pushTextTrap(&traps, min(a, b) * 10, "\(min(a, b)) 不是 \(max(a, b)) 的倍数", P * 10)
        fillTextTraps(&traps, P * 10)
        return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最小公倍数是？", correct: text(P), traps: traps)
    }
    // 有公因数对（主战场）：L = 乘积 ÷ 最大公因数
    let (a, b) = pick(rng, LCM_PAIRS)
    let g = gcd(a, b)
    let L = a * b / g
    var traps: [Trap] = []
    pushTextTrap(&traps, a * b * 10, "\(a * b) 是公倍数但不是最小的——它们有公因数 \(g)", L * 10)
    pushTextTrap(&traps, g * 10, "那是最大公因数！公倍数要比两个数都大", L * 10)
    pushTextTrap(&traps, max(a, b) * 10, "\(max(a, b)) 不是 \(min(a, b)) 的倍数", L * 10)
    return makeQuestion(rng: rng, prompt: text("\(a) 和 \(b)"), requirement: "最小公倍数是？", correct: text(L), traps: traps)
}

/* ---------------- Skill 定义 ---------------- */

let factorSenseSkill = Skill(
    id: "g5-ns-factor",
    title: "因数枚举",
    intro: [
        "考核点：因数识别与配对枚举（数感地基 1/5）",
        "因数成对出现：24 = 1×24 = 2×12 = 3×8 = 4×6，别漏 1 和它自己！",
        "这是最大公因数的前置功夫",
        "每题限时 6 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    numericKeypad: true,
    generators: [genFactorSense]
)

let divisSenseSkill = Skill(
    id: "g5-ns-divis",
    title: "整除特征",
    intro: [
        "考核点：不试除，一眼看出能不能整除（数感地基 2/5）",
        "3 和 9 看数字和；2、5、10 看个位；4 和 25 看末两位",
        "6 = 2 × 3，两个条件都要满足",
        "每题限时 5 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 5,
    questionCount: 10,
    numericKeypad: true,
    generators: [genDivisSense]
)

let primeSenseSkill = Skill(
    id: "g5-ns-prime",
    title: "质数与合数",
    intro: [
        "考核点：辨质数 + 分解质因数（数感地基 3/5）",
        "小心伪装者：51 = 3×17、57 = 3×19、91 = 7×13！",
        "分解质因数要分到每个数都是质数：12 = 2²×3，写成 2×6 不算完",
        "每题限时 6 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    supportsReview: false, // 分解质因数写法（2²×3）键盘输不了，只出选择题
    generators: [genPrimeSense]
)

let gcdSenseSkill = Skill(
    id: "g5-ns-gcd",
    title: "最大公因数",
    intro: [
        "考核点：最大公因数秒答（数感地基 4/5，约分的地基）",
        "倍数关系 → 较小数本身；互质 → 1",
        "其它情况：找公有因数里最大的一个",
        "每题限时 6 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    numericKeypad: true,
    generators: [genGcdSense]
)

let lcmSenseSkill = Skill(
    id: "g5-ns-lcm",
    title: "最小公倍数",
    intro: [
        "考核点：最小公倍数秒答（数感地基 5/5，通分的地基）",
        "倍数关系 → 较大数本身；互质 → 直接相乘",
        "有公因数 → 乘积 ÷ 最大公因数（例如 6 和 8：48 ÷ 2 = 24）",
        "每题限时 6 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    numericKeypad: true,
    generators: [genLcmSense]
)
