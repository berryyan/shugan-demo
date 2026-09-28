import Foundation

/**
 * 五年级 · 数感基础题库 —— 与 bank.ts 逐行对应。
 * 小数⇄分数转换 / 分数改写 / 约分训练 / 大小比较
 */

/* ---------------- 小数 ⇄ 分数转换（四类均匀轮转） ---------------- */

/** 题型 A：纯小数 → 最简分数 */
func genDecimalToFraction(_ rng: Mulberry32) -> Question {
    let d = pick(rng, DENOMINATORS)
    let n = randomNumerator(rng, d)
    let dec = fracToDecimalText(n, d)
    var traps: [Trap] = [
        (decimalToUnreducedFrac(dec), "数值相等但没有约成最简分数，还要继续约分"),
        (frac(d, n), "分子分母写反了，真分数的值小于 1"),
    ]
    let n2s = altNumerators(d, n)
    if !n2s.isEmpty {
        traps.append((frac(pick(rng, n2s), d), "分子看错了，再仔细数一数小数部分的值"))
    }
    let d2s = altDenominators(d, n)
    if !d2s.isEmpty {
        traps.append((frac(n, pick(rng, d2s)), "分母看错了"))
    }
    return makeQuestion(rng: rng, prompt: text(dec), requirement: "用最简分数表示", correct: frac(n, d), traps: traps)
}

/** 题型 B：纯分数 → 小数 */
func genFractionToDecimal(_ rng: Mulberry32) -> Question {
    let d = pick(rng, DENOMINATORS)
    let n = randomNumerator(rng, d)
    let ans = fracToDecimalText(n, d)
    var traps: [Trap] = [
        (text("0.\(n)\(d)"), "不能把分子分母直接拼在小数点后，要算出分数的值"),
        (text("0.0\(ans.dropFirst(2))"), "小数点位置错了，注意这个分数不到 1 但也没那么小"),
    ]
    let n2s = altNumerators(d, n)
    if !n2s.isEmpty {
        traps.append((text(fracToDecimalText(pick(rng, n2s), d)), "分子看错了"))
    }
    let d2s = altDenominators(d, n)
    if !d2s.isEmpty {
        traps.append((text(fracToDecimalText(n, pick(rng, d2s))), "分母看错了"))
    }
    return makeQuestion(rng: rng, prompt: frac(n, d), requirement: "用小数表示", correct: text(ans), traps: traps)
}

/** 题型 C：带整数的小数 → 带分数（分数部分最简） */
func genMixedDecimalToFraction(_ rng: Mulberry32) -> Question {
    let w = randomWhole(rng)
    let d = pick(rng, DENOMINATORS)
    let n = randomNumerator(rng, d)
    let dec = fracToDecimalText(n, d, whole: w)
    let fracDigits = String(dec.split(separator: ".", omittingEmptySubsequences: false)[1])
    let denominator = Int(pow(10.0, Double(fracDigits.count)))
    let unreducedN = Int(fracDigits) ?? 0
    var traps: [Trap] = [
        (.mixed(whole: String(w), n: String(unreducedN), d: String(denominator)), "分数部分数值相等但没有约成最简，还要继续约分"),
        (frac(w * d + n, d), "这是相等的假分数，但题目要求带分数形式"),
        (mixed(w + 1, n, d), "整数部分看错了"),
    ]
    let n2s = altNumerators(d, n)
    if !n2s.isEmpty {
        traps.append((mixed(w, pick(rng, n2s), d), "小数部分的分子看错了"))
    }
    return makeQuestion(rng: rng, prompt: text(dec), requirement: "用带分数表示（分数部分最简）", correct: mixed(w, n, d), traps: traps)
}

/** 题型 D：带分数 → 小数 */
func genMixedFractionToDecimal(_ rng: Mulberry32) -> Question {
    let w = randomWhole(rng)
    let d = pick(rng, DENOMINATORS)
    let n = randomNumerator(rng, d)
    var traps: [Trap] = [
        (text("\(w).\(n)\(d)"), "不能把分子分母直接拼在小数点后，要先算分数部分的值"),
        (text(fracToDecimalText(n, d)), "漏掉了整数部分"),
        (text(fracToDecimalText(n, d, whole: w + 1)), "整数部分看错了"),
    ]
    let n2s = altNumerators(d, n)
    if !n2s.isEmpty {
        traps.append((text(fracToDecimalText(pick(rng, n2s), d, whole: w)), "分子看错了"))
    }
    return makeQuestion(rng: rng, prompt: mixed(w, n, d), requirement: "用小数表示", correct: text(fracToDecimalText(n, d, whole: w)), traps: traps)
}

let rationalConvertSkill = Skill(
    id: "g6-rational-convert",
    title: "小数 ⇄ 分数转换",
    intro: [
        "考核点：小数与分数双向转换，纯小数 / 纯分数 / 带整数小数 / 带分数四类均匀出题",
        "分母围绕常考的 2、4、5、8、10，分子随机（保证最简），带整数题整数部分 1~100",
        "小数 → 分数：写成最简分数或带分数（例如 0.125 = ⅛，1.75 = 1¾）",
        "每题限时 10 秒，答错扣分，连续答对有加成——不要瞎猜！",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    generators: [genDecimalToFraction, genFractionToDecimal, genMixedDecimalToFraction, genMixedFractionToDecimal]
)

/* ---------------- 分数改写（假分数 ⇄ 带分数） ---------------- */

/** 改写用的随机参数：分母 2/3/4/5/6/8，整数部分 1~6，余数与分母互质 */
func randomRewriteParams(_ rng: Mulberry32) -> (d: Int, r: Int, w: Int, n: Int) {
    let d = pick(rng, REWRITE_DENOMINATORS)
    let r = randomNumerator(rng, d)
    let w = 1 + Int(rng.next() * 6)
    return (d, r, w, w * d + r)
}

/** A2-a：假分数 → 带分数（如 7/6 = 1⅙） */
func genImproperToMixed(_ rng: Mulberry32) -> Question {
    let p = randomRewriteParams(rng)
    var traps: [Trap] = [
        (mixed(p.w + 1, p.r, p.d), "商算大了，分一分数里面有几个分母"),
        (frac(p.r, p.d), "漏掉了整数部分"),
        (frac(p.d, p.n), "分子分母写反了，假分数的值大于 1"),
    ]
    let r2s = altNumerators(p.d, p.r)
    if !r2s.isEmpty {
        traps.append((mixed(p.w, pick(rng, r2s), p.d), "余数算错了：商 × 分母 + 余数 = 分子"))
    }
    if p.w >= 2 {
        traps.append((mixed(p.w - 1, p.r, p.d), "商算小了，剩下的部分还够再分一份"))
    }
    return makeQuestion(rng: rng, prompt: frac(p.n, p.d), requirement: "用带分数表示", correct: mixed(p.w, p.r, p.d), traps: traps)
}

/** A2-b：带分数 → 假分数（如 2⅓ = 7/3） */
func genMixedToImproper(_ rng: Mulberry32) -> Question {
    let p = randomRewriteParams(rng)
    var traps: [Trap] = [
        (frac(p.w + p.r, p.d), "整数部分要先乘分母再加分子，不是直接相加"),
        (frac(p.r, p.d), "漏掉了整数部分"),
        (frac((p.w + 1) * p.d + p.r, p.d), "整数部分看错了，多数了一份"),
    ]
    let r2s = altNumerators(p.d, p.r)
    if !r2s.isEmpty {
        traps.append((frac(p.w * p.d + pick(rng, r2s), p.d), "分子算错了：整数 × 分母 + 原分子"))
    }
    return makeQuestion(rng: rng, prompt: mixed(p.w, p.r, p.d), requirement: "用假分数表示", correct: frac(p.n, p.d), traps: traps)
}

let rewriteSkill = Skill(
    id: "g6-sense-rewrite",
    title: "分数改写",
    intro: [
        "考核点：假分数 ⇄ 带分数互化（数感原子能力 A2）",
        "假分数 → 带分数：分子 ÷ 分母，商是整数部分、余数是分子（例如 7/6 = 1⅙）",
        "带分数 → 假分数：整数 × 分母 + 分子（例如 2⅓ = 7/3）",
        "每题限时 10 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    generators: [genImproperToMixed, genMixedToImproper]
)

/* ---------------- 约分训练 ---------------- */

func genSimplify(_ rng: Mulberry32) -> Question {
    let MULTIPLIERS = [4, 6, 8, 9, 10, 15, 25]
    var n = 1, d = 2, k = 4
    for _ in 0..<50 {
        let td = pick(rng, [3, 4, 5, 6, 7, 8, 9])
        let tn = randomNumerator(rng, td)
        let tk = pick(rng, MULTIPLIERS)
        if td * tk <= 100 {
            n = tn
            d = td
            k = tk
            break
        }
    }
    // k 的每个真因子对应一种"只约了一部分"的中间态
    let partials: [Trap] = [2, 3, 5]
        .filter { k % $0 == 0 && k / $0 > 1 }
        .map { (frac(n * (k / $0), d * (k / $0)), "没约干净，要约到分子分母互质为止") }
    var traps: [Trap] = partials
    traps.append((frac(n, d * k), "只约了分母，分子也要除以同一个数"))
    traps.append((frac(n * k, d), "只约了分子，分母也要除以同一个数"))
    traps.append((frac(n * k - 1, d * k - 1), "分子分母要除以同一个数，不是减去同一个数"))
    return makeQuestion(rng: rng, prompt: frac(n * k, d * k), requirement: "约成最简分数", correct: frac(n, d), traps: traps)
}

let simplifySkill = Skill(
    id: "g6-sense-simplify",
    title: "约分训练",
    intro: [
        "考核点：把分数约成最简形式（数感原子能力 A3）",
        "分子分母同时除以公因数，一直约到互质为止（例如 25/75 = 1/3）",
        "小心“没约干净”的选项——约了一半不算对！",
        "每题限时 10 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    generators: [genSimplify]
)

/* ---------------- 大小比较（固定三选一题型） ---------------- */

func genCompare(_ rng: Mulberry32) -> Question {
    let equal = rng.next() < 0.2
    let d1 = pick(rng, CMP_DENOMINATORS)
    let n1 = randomNumerator(rng, d1)
    let left = frac(n1, d1)
    var right: MathExpr?
    if equal {
        // 等值不同形态：优先换成小数；除不尽的分母（3）换成等值分数
        right = DECIMAL_OK.contains(d1) ? text(fracToDecimalText(n1, d1)) : frac(n1 * 2, d1 * 2)
    } else {
        let crossForm = rng.next() < 0.4
        // 制造"接近但不同"的值，逼出数感而非硬算
        for _ in 0..<50 {
            let d2 = pick(rng, CMP_DENOMINATORS)
            let n2 = randomNumerator(rng, d2)
            if d1 == d2 && n1 == n2 { continue }
            let v1 = Double(n1) / Double(d1)
            let v2 = Double(n2) / Double(d2)
            if v1 == v2 { continue }
            if abs(v1 - v2) > 0.3 { continue }
            right = (crossForm && DECIMAL_OK.contains(d2)) ? text(fracToDecimalText(n2, d2)) : frac(n2, d2)
            break
        }
        // 极端兜底（理论上到不了）
        if right == nil {
            right = frac(randomNumerator(rng, 8, exclude: n1 == 1 ? 1 : nil), 8)
        }
    }
    let theRight = right!
    let vL = Double(n1) / Double(d1)
    let vR = exprValue(theRight)
    let isEqual = abs(vL - vR) < 1e-9
    let sameText = text("一样大")
    let prompt = MathExpr.vs(left: left, right: theRight)
    if isEqual {
        let traps: [Trap] = [
            (left, "两边其实相等"),
            (theRight, "两边其实相等"),
        ]
        return makeQuestion(rng: rng, prompt: prompt, requirement: "哪边更大？", correct: sameText, traps: traps)
    }
    let bigger = vL > vR ? left : theRight
    let smaller = vL > vR ? theRight : left
    let traps: [Trap] = [
        (smaller, "这个更小，可以在心里先换成同一种形式再比"),
        (sameText, "两边不相等，差得不多，仔细比"),
    ]
    return makeQuestion(rng: rng, prompt: prompt, requirement: "哪边更大？", correct: bigger, traps: traps)
}

let compareSkill = Skill(
    id: "g6-sense-compare",
    title: "大小比较",
    intro: [
        "考核点：不硬算，凭数感比较分数/小数大小（数感原子能力 B1）",
        "技巧：在心里把两边换成同一种形式再比（例如 ⅝ = 0.625 > 0.6）",
        "约两成题目两边其实相等——不要被不同写法骗了！",
        "每题限时 8 秒，答错扣分，连续答对有加成！",
    ],
    timeLimitSec: 8,
    questionCount: 10,
    supportsReview: false, // 三选一题型不适合填空
    generators: [genCompare]
)
