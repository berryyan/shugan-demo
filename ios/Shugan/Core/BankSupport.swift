import Foundation

/**
 * 题库共享工具 —— 与网页版 bank.ts 的工具函数逐行对应。
 * 原则：思路独立（各题库自己的生成/干扰项逻辑），工具共享。
 */

typealias Trap = (value: MathExpr, trap: String)

func pick<T>(_ rng: Mulberry32, _ arr: [T]) -> T {
    arr[Int(rng.next() * Double(arr.count))]
}

func shuffle<T>(_ rng: Mulberry32, _ arr: [T]) -> [T] {
    var a = arr
    guard a.count > 1 else { return a }
    for i in stride(from: a.count - 1, through: 1, by: -1) {
        let j = Int(rng.next() * Double(i + 1))
        a.swapAt(i, j)
    }
    return a
}

/* ---------------- 表达式构造 ---------------- */

func frac(_ n: String, _ d: String) -> MathExpr { .frac(n: n, d: d) }
func frac(_ n: Int, _ d: Int) -> MathExpr { .frac(n: String(n), d: String(d)) }
func text(_ t: String) -> MathExpr { .text(t) }
func text(_ t: Int) -> MathExpr { .text(String(t)) }
func mixed(_ w: Int, _ n: Int, _ d: Int) -> MathExpr { .mixed(whole: String(w), n: String(n), d: String(d)) }

/* ---------------- 组题（防御性去重 + 洗牌，与 TS makeQuestion 一致） ---------------- */

private var qidCounter = 0

func makeQuestion(rng: Mulberry32, prompt: MathExpr, requirement: String, correct: MathExpr, traps: [Trap]) -> Question {
    // 剔除与正确答案相同的干扰项，并按表达式去重
    var seen = Set<String>([exprKey(correct)])
    var cleanTraps: [Trap] = []
    for t in traps {
        let k = exprKey(t.value)
        if seen.contains(k) { continue }
        seen.insert(k)
        cleanTraps.append(t)
    }
    // 固定保留 3 个干扰项（洗牌在切片之前，与 TS 的随机数消耗顺序一致）
    let kept = shuffle(rng, cleanTraps).prefix(min(cleanTraps.count, 3))
    var choices: [Choice] = [Choice(id: "c", value: correct, correct: true, trap: nil)]
    for (i, t) in kept.enumerated() {
        choices.append(Choice(id: "t\(i)", value: t.value, correct: false, trap: t.trap))
    }
    choices = shuffle(rng, choices)
    qidCounter += 1
    return Question(id: "q\(qidCounter)", prompt: prompt, requirement: requirement, choices: choices)
}

/* ---------------- 数论工具 ---------------- */

func gcd(_ a: Int, _ b: Int) -> Int { b != 0 ? gcd(b, a % b) : a }
func lcm(_ a: Int, _ b: Int) -> Int { (a / gcd(a, b)) * b }

/** 某分母下所有满足最简的分子（剔除可约分的） */
func coprimeNumerators(_ d: Int) -> [Int] {
    var list: [Int] = []
    for n in 1..<d where gcd(n, d) == 1 { list.append(n) }
    return list
}

/** 随机分子：1~d-1 中只保留与分母互质的 */
func randomNumerator(_ rng: Mulberry32, _ d: Int, exclude: Int? = nil) -> Int {
    let candidates = coprimeNumerators(d).filter { $0 != exclude }
    return pick(rng, candidates)
}

/** 带整数题的整数部分：1~10 占 50%，11~100 占 50% */
func randomWhole(_ rng: Mulberry32) -> Int {
    rng.next() < 0.5 ? 1 + Int(rng.next() * 10) : 11 + Int(rng.next() * 90)
}

/* ---------------- 常考分母与组合 ---------------- */

let DENOMINATORS = [2, 4, 5, 8, 10]          // 小数⇄分数转换
let REWRITE_DENOMINATORS = [2, 3, 4, 5, 6, 8] // 分数改写
let CMP_DENOMINATORS = [2, 3, 4, 5, 8, 10]    // 大小比较
let DECIMAL_OK = [2, 4, 5, 8, 10]             // 除得尽（能整除 1000）
let ARITH_DENOMS = [2, 3, 4, 5, 6, 8]         // 分数四则
let MULTIPLE_PAIRS: [(Int, Int)] = [(2, 4), (2, 6), (3, 6), (2, 8), (4, 8)]
let COPRIME_PAIRS: [(Int, Int)] = [(2, 3), (2, 5), (3, 4), (3, 5), (4, 5), (5, 6)]

/** 分子看错的候选（同分母下其他互质分子） */
func altNumerators(_ d: Int, _ n: Int) -> [Int] {
    coprimeNumerators(d).filter { $0 != n }
}

/** 分母看错的候选（≠d、大于分子、与分子互质） */
func altDenominators(_ d: Int, _ n: Int) -> [Int] {
    DENOMINATORS.filter { $0 != d && n < $0 && gcd(n, $0) == 1 }
}

/**
 * n/d（可带整数部分）的精确小数字符串。
 * 仅支持能整除 1000 的分母（2,4,5,8,10）；其他分母返回空串。
 * 全程整数运算，避免浮点误差。
 */
func fracToDecimalText(_ n: Int, _ d: Int, whole: Int = 0) -> String {
    if 1000 % d != 0 { return "" }
    let scaled = whole * 1000 + n * (1000 / d)
    var s = String(scaled)
    while s.count < 4 { s = "0" + s }
    let idx = s.index(s.endIndex, offsetBy: -3)
    var out = String(s[..<idx]) + "." + String(s[idx...])
    while out.hasSuffix("0") { out.removeLast() }
    if out.hasSuffix(".") { out.removeLast() }
    return out
}

/** 小数文本 → 未约分形式的分数（如 0.375 → 375/1000） */
func decimalToUnreducedFrac(_ decText: String) -> MathExpr {
    let parts = decText.split(separator: ".", omittingEmptySubsequences: false)
    let denominator = Int(pow(10.0, Double(parts[1].count)))
    let numerator = (Int(parts[0]) ?? 0) * denominator + (Int(parts[1]) ?? 0)
    return frac(numerator, denominator)
}

/* ---------------- 分数运算通用 ---------------- */

/** 约分到最简（带绝对值，支持负数分子） */
func reduce2(_ n: Int, _ d: Int) -> (Int, Int) {
    let g = gcd(abs(n), abs(d))
    return (n / g, d / g)
}

/** 运算结果 → MathExpr：整数 → text；>1 → 带分数；其余 → 最简分数 */
func ansExpr(_ n: Int, _ d: Int) -> MathExpr {
    let (rn, rd) = reduce2(n, d)
    if rn % rd == 0 { return text(rn / rd) }
    if rn < rd { return frac(rn, rd) }
    return mixed(rn / rd, rn % rd, rd)
}

/** 未约分形态干扰项（数值故意相等，考验"要约到最简"） */
func unreducedExpr(_ n: Int, _ d: Int) -> MathExpr {
    if n % d == 0 { return text(n / d) }
    if n < d { return frac(n, d) }
    return mixed(n / d, n % d, d)
}

/** 加陷阱：非形态类陷阱若数值恰等于正确答案则剔除 */
func pushTrap(_ traps: inout [Trap], _ value: MathExpr, _ trap: String, _ correctVal: Double, allowEqual: Bool = false) {
    if !allowEqual && abs(exprValue(value) - correctVal) < 1e-9 { return }
    traps.append((value, trap))
}

/** 形态类陷阱：可约分时出"未约分等价" */
func formTraps(_ traps: inout [Trap], _ N: Int, _ D: Int) {
    if gcd(N, D) > 1 {
        traps.append((unreducedExpr(N, D), "数值相等但没有约成最简，还要继续约分"))
    }
}

/** 兜底：干扰项候选不足 4 个时，用"差一点点"的邻值补齐 */
func fillTraps(_ traps: inout [Trap], _ N: Int, _ D: Int) {
    let correctVal = Double(N) / Double(D)
    var keys = Set(traps.map { exprKey($0.value) })
    let cands: [(Int, Int)] = [
        (N + 1, D), (N, D + 1), (N, D * 2), (N * 2, D * 2 + 1), (N + 1, D * 2),
        (N + 2, D), (N * 2 + 1, D * 2), (N, D * 3), (N + 3, D),
    ]
    for (n, d) in cands {
        if keys.count >= 4 { break }
        let v = frac(n, d)
        let k = exprKey(v)
        if keys.contains(k) || abs(exprValue(v) - correctVal) < 1e-9 { continue }
        keys.insert(k)
        traps.append((v, "差一点点，再仔细算一遍"))
    }
}

/** 加减法两项的分母/分子组合：同分母 50%，异分母中 70% 倍数关系、30% 互质 */
func pickAddSubPair(_ rng: Mulberry32) -> (d1: Int, d2: Int, n1: Int, n2: Int) {
    let d1: Int
    let d2: Int
    let r = rng.next()
    if r < 0.5 {
        let d = pick(rng, ARITH_DENOMS)
        d1 = d
        d2 = d
    } else if r < 0.85 {
        let p = pick(rng, MULTIPLE_PAIRS)
        (d1, d2) = rng.next() < 0.5 ? p : (p.1, p.0)
    } else {
        let p = pick(rng, COPRIME_PAIRS)
        (d1, d2) = rng.next() < 0.5 ? p : (p.1, p.0)
    }
    return (d1, d2, randomNumerator(rng, d1), randomNumerator(rng, d2))
}

/* ---------------- 正负数（十分位整数运算） ---------------- */

/** 十分位整数 → 显示文本（如 -35 → "-3.5"，200 → "20"） */
func fmtTenth(_ t: Int) -> String {
    let sign = t < 0 ? "-" : ""
    let a = abs(t)
    let i = a / 10
    let f = a % 10
    return sign + (f == 0 ? String(i) : "\(i).\(f)")
}

/** 有符号数：整数(±20) 或 一位小数(±9.9)，不含 0；返回十分位整数 */
func signedTenth(_ rng: Mulberry32, _ decimal: Bool) -> Int {
    if decimal {
        var t = Int(rng.next() * 197) - 98 // -98..98
        if t % 10 == 0 { t += 1 + Int(rng.next() * 8) } // 避开整数位
        return t
    }
    let t = (Int(rng.next() * 39) - 19) * 10 // ±19 的整数
    return t == 0 ? 10 : t
}

/** 非零整数（±maxAbs 内，返回十分位整数） */
func intTenth(_ rng: Mulberry32, _ maxAbs: Int) -> Int {
    let k = 1 + Int(rng.next() * Double(maxAbs))
    return (rng.next() < 0.5 ? -1 : 1) * k * 10
}

/** 文本陷阱兜底：邻值补齐到 4 个不重复候选 */
func fillTextTraps(_ traps: inout [Trap], _ rTenth: Int) {
    var keys = Set(traps.map { exprKey($0.value) })
    for dt in [10, -10, 20, -20, 30, -30, 40, -40] {
        if keys.count >= 4 { break }
        let v = text(fmtTenth(rTenth + dt))
        let k = exprKey(v)
        if keys.contains(k) { continue }
        keys.insert(k)
        traps.append((v, "差一点点，再仔细算一遍"))
    }
}

func pushTextTrap(_ traps: inout [Trap], _ tTenth: Int, _ trap: String, _ correctTenth: Int) {
    if tTenth == correctTenth { return }
    traps.append((text(fmtTenth(tTenth)), trap))
}

/* ---------------- 有理数精确计算（分数小数混合四则用） ---------------- */

func red(_ n: Int, _ d: Int) -> (Int, Int) {
    let g = gcd(abs(n), abs(d))
    return (n / (g == 0 ? 1 : g), d / (g == 0 ? 1 : g))
}
func rAdd(_ x: (Int, Int), _ y: (Int, Int)) -> (Int, Int) { red(x.0 * y.1 + y.0 * x.1, x.1 * y.1) }
func rSub(_ x: (Int, Int), _ y: (Int, Int)) -> (Int, Int) { red(x.0 * y.1 - y.0 * x.1, x.1 * y.1) }
func rMul(_ x: (Int, Int), _ y: (Int, Int)) -> (Int, Int) { red(x.0 * y.0, x.1 * y.1) }
func rDiv(_ x: (Int, Int), _ y: (Int, Int)) -> (Int, Int) { red(x.0 * y.1, x.1 * y.0) }
func rVal(_ x: (Int, Int)) -> Double { Double(x.0) / Double(x.1) }

/** 分母只含因数 2/5 → 可写成有限小数 */
func isDecDenom(_ d: Int) -> Bool {
    var x = d
    while x % 2 == 0 { x /= 2 }
    while x % 5 == 0 { x /= 5 }
    return x == 1
}

/** 与 TS String(parseFloat((n/d).toFixed(6))) 等价的有限小数文本 */
func fmtDecimal6(_ n: Int, _ d: Int) -> String {
    var s = String(format: "%.6f", Double(n) / Double(d))
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s
}

/** 有理数的最佳显示形态：整数/有限小数 → 文本；>1 的非小数 → 带分数；其余 → 分数 */
func fmtRat(_ x: (Int, Int)) -> MathExpr {
    let (n, d) = red(x.0, x.1)
    if n == 0 { return text("0") }
    if d == 1 { return text(n) }
    if isDecDenom(d) { return text(fmtDecimal6(n, d)) }
    if n > d { return mixed(n / d, n % d, d) }
    return frac(n, d)
}

/** 小数倒数锚点表：[小数文本, 倒数表达式] */
let RECIP_DECIMALS: [(String, MathExpr)] = [
    ("0.5", text("2")), ("0.25", text("4")), ("0.2", text("5")), ("0.125", text("8")),
    ("0.4", frac(5, 2)), ("0.75", frac(4, 3)), ("1.5", frac(2, 3)), ("1.25", frac(4, 5)),
]

/** 小数锚点表：[小数文本, 分子, 分母]——混合题的小数都来自这张表 */
let DEC_ANCHORS: [(String, Int, Int)] = [
    ("0.5", 1, 2), ("0.25", 1, 4), ("0.2", 1, 5), ("0.125", 1, 8), ("0.75", 3, 4),
    ("0.4", 2, 5), ("0.6", 3, 5), ("1.5", 3, 2), ("1.25", 5, 4), ("2.5", 5, 2),
]

/** 常见转换误区：小数记错的对应分数 */
let WRONG_ANCHOR: [String: (Int, Int)] = [
    "0.25": (1, 5), "0.2": (1, 4), "0.125": (1, 4), "0.5": (1, 4),
    "0.75": (3, 5), "0.4": (1, 4), "0.6": (3, 4), "1.25": (3, 2),
]
