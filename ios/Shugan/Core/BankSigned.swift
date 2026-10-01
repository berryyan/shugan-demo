import Foundation

/**
 * 六年级 · 有理数题库（一）—— 与 bank.ts 逐行对应。
 * 正负数加减 / 符号快闪 / 通分快闪 / 交叉约分 / 倒数快闪 /
 * 相反数与绝对值 / 正负数比大小 / 乘除符号快闪 / 正负数乘除
 */

/* ---------------- 正负数加减（两项 90% + 三项代数和 10%） ---------------- */

func genSignedAddSub(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.1 {
        // 三项代数和：a + b + c（各项自带符号）
        let a = signedTenth(rng, false)
        let b = signedTenth(rng, false)
        let c = signedTenth(rng, false)
        let r = a + b + c
        var traps: [Trap] = []
        pushTextTrap(&traps, -r, "符号看反了", r)
        pushTextTrap(&traps, (abs(a) + abs(b) + abs(c)) * (r >= 0 ? 1 : -1), "不能全当同号相加，负项要抵消", r)
        pushTextTrap(&traps, a + b - c, "最后一项的符号看错了", r)
        fillTextTraps(&traps, r)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: [text(fmtTenth(a)), text(fmtTenth(b)), text(fmtTenth(c))]),
            requirement: "计算（注意正负号）",
            correct: text(fmtTenth(r)),
            traps: traps
        )
    }
    let decimal = rng.next() < 0.3
    let a = signedTenth(rng, decimal)
    let b = signedTenth(rng, decimal)
    let isSub = rng.next() < 0.5
    let r = isSub ? a - b : a + b
    var traps: [Trap] = []
    if isSub {
        pushTextTrap(&traps, b - a, "方向反了：被减数 − 减数，不是倒过来减", r)
        pushTextTrap(&traps, a + b, "减去一个数 = 加上它的相反数，符号要变", r)
        pushTextTrap(&traps, -r, "符号看反了", r)
    } else if (a > 0) != (b > 0) {
        // 异号相加
        let bigSign = abs(a) > abs(b) ? (a > 0 ? 1 : -1) : (b > 0 ? 1 : -1)
        pushTextTrap(&traps, bigSign * (abs(a) + abs(b)), "异号相加是绝对值抵消，不是相加", r)
        pushTextTrap(&traps, -r, "符号看反了：跟绝对值大的数走", r)
        pushTextTrap(&traps, (abs(a) + abs(b)) * -bigSign, "异号相加既算错又丢符号", r)
    } else {
        // 同号相加
        pushTextTrap(&traps, abs(a) - abs(b), "同号相加，绝对值要相加，不是抵消", r)
        pushTextTrap(&traps, -r, "同号相加符号不变", r)
    }
    fillTextTraps(&traps, r)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: isSub ? "-" : "+", terms: [text(fmtTenth(a)), text(fmtTenth(b))]),
        requirement: "计算（注意正负号）",
        correct: text(fmtTenth(r)),
        traps: traps
    )
}

/* ---------------- 符号快闪：只判正负，固定 3 选项 ---------------- */

func genSignFlash(_ rng: Mulberry32) -> Question {
    let pos = text("正数")
    let neg = text("负数")
    let zero = text("等于 0")
    let hint = "异号相加，符号跟绝对值大的数走；同号相加符号不变"
    // 12% 恰为 0：互为相反数
    if rng.next() < 0.12 {
        let a = (1 + Int(rng.next() * 15)) * 10
        let first = rng.next() < 0.5
        let terms = first
            ? [text(fmtTenth(-a)), text(fmtTenth(a))]
            : [text(fmtTenth(a)), text(fmtTenth(-a))]
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: terms),
            requirement: "不计算，判断结果是正还是负",
            correct: zero,
            traps: [
                (pos, "这两个数互为相反数，相加等于 0"),
                (neg, "这两个数互为相反数，相加等于 0"),
            ]
        )
    }
    let three = rng.next() < 0.2
    let isSub = !three && rng.next() < 0.4
    let a = signedTenth(rng, false)
    let b = signedTenth(rng, false)
    if three {
        let c = signedTenth(rng, false)
        let v = a + b + c
        let correct = v > 0 ? pos : v < 0 ? neg : zero
        let ck = exprKey(correct)
        let traps: [Trap] = [pos, neg, zero]
            .filter { exprKey($0) != ck }
            .map { ($0, exprKey($0) == "等于 0" ? "三项不会恰好抵消，再估一估绝对值" : hint) }
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: [text(fmtTenth(a)), text(fmtTenth(b)), text(fmtTenth(c))]),
            requirement: "不计算，判断结果是正还是负",
            correct: correct,
            traps: traps
        )
    }
    let v = isSub ? a - b : a + b
    let correct = v > 0 ? pos : v < 0 ? neg : zero
    let ck = exprKey(correct)
    let traps: [Trap] = [pos, neg, zero]
        .filter { exprKey($0) != ck }
        .map { x in
            let trap: String
            if exprKey(x) == "等于 0" {
                trap = "两边绝对值不一样大，不会等于 0"
            } else if isSub {
                trap = "减去负数 = 加正数，方向想清楚"
            } else {
                trap = hint
            }
            return (x, trap)
        }
    return makeQuestion(
        rng: rng,
        prompt: .op(op: isSub ? "-" : "+", terms: [text(fmtTenth(a)), text(fmtTenth(b))]),
        requirement: "不计算，判断结果是正还是负",
        correct: correct,
        traps: traps
    )
}

/* ---------------- 通分快闪（答案故意不约分） ---------------- */

func genCommonDenom(_ rng: Mulberry32) -> Question {
    let d1: Int
    let d2: Int
    if rng.next() < 0.5 {
        let p = pick(rng, MULTIPLE_PAIRS)
        (d1, d2) = rng.next() < 0.5 ? p : (p.1, p.0)
    } else {
        let p = pick(rng, COPRIME_PAIRS)
        (d1, d2) = rng.next() < 0.5 ? p : (p.1, p.0)
    }
    let n1 = randomNumerator(rng, d1)
    let n2 = randomNumerator(rng, d2)
    let L = lcm(d1, d2)
    let prompt = MathExpr.op(op: "和", terms: [frac(n1, d1), frac(n2, d2)])
    if rng.next() < 0.6 {
        // 问其中一边通分后的样子；若某边分母已是 L 则固定问另一边
        var askFirst = rng.next() < 0.5
        if askFirst && d1 == L { askFirst = false }
        if !askFirst && d2 == L { askFirst = true }
        let qN = askFirst ? n1 : n2
        let qD = askFirst ? d1 : d2
        let oN = askFirst ? n2 : n1
        let oD = askFirst ? d2 : d1
        let cN = qN * (L / qD)
        let v = Double(cN) / Double(L)
        var traps: [Trap] = []
        pushTrap(&traps, frac(oN * (L / oD), L), "那是另一个分数通分后的样子，看清问的是哪边", v)
        pushTrap(&traps, frac(qN, L), "通分后分子也要乘同样的倍数", v)
        pushTrap(&traps, frac(cN, qD), "分母要变成两个分母的公倍数", v)
        fillTraps(&traps, cN, L)
        return makeQuestion(rng: rng, prompt: prompt, requirement: "把 \(qN)/\(qD) 通分后变成哪个？", correct: frac(cN, L), traps: traps)
    }
    // 问最小公分母
    var traps: [Trap] = []
    pushTrap(&traps, text(d1 * d2), "可以更小：用两个分母的最小公倍数", Double(L))
    pushTrap(&traps, text(d1 + d2), "公分母不是把分母相加", Double(L))
    pushTrap(&traps, text(L * 2), "是公倍数但不是最小的", Double(L))
    var keys = Set(traps.map { exprKey($0.value) })
    for dt in [1, -1, 2, 4, -2] {
        if keys.count >= 4 { break }
        if L + dt <= 0 { continue }
        let v2 = text(L + dt)
        let k = exprKey(v2)
        if keys.contains(k) { continue }
        keys.insert(k)
        traps.append((v2, "差一点点，再算一遍"))
    }
    return makeQuestion(rng: rng, prompt: prompt, requirement: "通分用的最小公分母是？", correct: text(L), traps: traps)
}

/* ---------------- 交叉约分 ---------------- */

func genCrossCancel(_ rng: Mulberry32) -> Question {
    // 构造 n1/d1 × n2/d2：n1 与 d2 有公因数 a（约完 x/y），n2 与 d1 有公因数 b（约完 z/w）
    var n1 = 2, d1 = 4, n2 = 2, d2 = 6, x = 1, y = 3, z = 1, w = 2
    for _ in 0..<80 {
        let a = pick(rng, [2, 3, 4, 5])
        let b = pick(rng, [2, 3, 4, 5])
        x = 1 + Int(rng.next() * 3)
        y = 2 + Int(rng.next() * 3)
        z = 1 + Int(rng.next() * 3)
        w = 2 + Int(rng.next() * 3)
        n1 = a * x
        d2 = a * y
        n2 = b * z
        d1 = b * w
        if n1 < d1 && n2 < d2 { break }
    }
    let c1 = reduce2(x, w)
    let c2 = reduce2(z, y)
    let promptExpr = MathExpr.op(op: "×", terms: [frac(n1, d1), frac(n2, d2)])
    let pv = exprValue(promptExpr)
    let correct = MathExpr.op(op: "×", terms: [frac(c1.0, c1.1), frac(c2.0, c2.1)])
    var traps: [Trap] = []
    pushTrap(&traps, .op(op: "×", terms: [frac(c1.0, c1.1), frac(n2, d2)]), "还没约完：右边的分子和左边的分母也能约", pv, allowEqual: true)
    pushTrap(&traps, .op(op: "×", terms: [frac(n1, d1), frac(c2.0, c2.1)]), "还没约完：另一对也能约", pv, allowEqual: true)
    pushTrap(&traps, .op(op: "×", terms: [frac(c1.0, c1.1 + 1), frac(c2.0, c2.1)]), "约分后分母算错了", pv)
    pushTrap(&traps, .op(op: "×", terms: [frac(c1.0 + 1, c1.1), frac(c2.0, c2.1)]), "约分后分子算错了", pv)
    return makeQuestion(rng: rng, prompt: promptExpr, requirement: "先约分再乘，约分后的式子是哪个？", correct: correct, traps: traps)
}

/* ---------------- 倒数快闪 ---------------- */

func genReciprocal(_ rng: Mulberry32) -> Question {
    let form = rng.next()
    let neg = rng.next() < 0.3
    let s = neg ? "-" : ""
    if form < 0.35 {
        // 真分数 → 假分数
        let d = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9])
        let n = randomNumerator(rng, d)
        let traps: [Trap] = [
            (frac(s + String(n), String(d)), "忘倒了：分子分母要交换位置"),
            (frac(s + String(d + 1), String(n)), "差一点点，再算一遍"),
            (frac(s + String(d), String(n + 1)), "差一点点，再算一遍"),
        ]
        return makeQuestion(rng: rng, prompt: frac(s + String(n), String(d)), requirement: "写出它的倒数", correct: frac(s + String(d), String(n)), traps: traps)
    }
    if form < 0.6 {
        // 整数 → 单位分数
        let k = 2 + Int(rng.next() * 11)
        let traps: [Trap] = [
            (text(s + String(k)), "整数的倒数是 1/\(k)，不是它本身"),
            (text(s + "1"), "倒数要倒过来，不是不变"),
            (frac(s + "2", String(k)), "分子是 1"),
        ]
        return makeQuestion(rng: rng, prompt: text(s + String(k)), requirement: "写出它的倒数", correct: frac(s + "1", String(k)), traps: traps)
    }
    if form < 0.8 {
        // 小数 → 整数或分数（锚点表）
        let pair = pick(rng, RECIP_DECIMALS)
        let dec = pair.0
        let ans = pair.1
        var traps: [Trap] = [(text(dec), "忘倒了，这是原数")]
        switch ans {
        case .text(let t):
            traps.append((text(String((Int(t) ?? 0) + 1)), "差一点点，再算一遍"))
            traps.append((text(String(max(1, (Int(t) ?? 0) - 1))), "差一点点，再算一遍"))
        case .frac(let n, let d):
            traps.append((frac(d, n), "倒的方向反了"))
            traps.append((frac(String((Int(n) ?? 0) + 1), d), "差一点点，再算一遍"))
        default:
            break
        }
        if neg {
            // 负数小数：题面与答案加负号；text 类干扰项加负号，分数类保持不变（与 TS 一致）
            let negAns: MathExpr
            switch ans {
            case .text(let t): negAns = text("-" + t)
            case .frac(let n, let d): negAns = frac("-" + n, d)
            default: negAns = ans
            }
            let negTraps: [Trap] = traps.map { t in
                if case .text(let txt) = t.value {
                    return (text("-" + txt), t.trap)
                }
                return t
            }
            return makeQuestion(rng: rng, prompt: text("-" + dec), requirement: "写出它的倒数", correct: negAns, traps: negTraps)
        }
        return makeQuestion(rng: rng, prompt: text(dec), requirement: "写出它的倒数", correct: ans, traps: traps)
    }
    // 带分数 → 假分数的倒数
    let w = 1 + Int(rng.next() * 3)
    let d = pick(rng, [2, 3, 4, 5, 6, 8])
    let n = randomNumerator(rng, d)
    let a = w * d + n
    let traps: [Trap] = [
        (frac(s + String(d), String(n)), "带分数要先化成假分数再倒，不能只倒分数部分"),
        (frac(s + String(a), String(d)), "这是原数（假分数形式），还没倒"),
        (frac(s + String(d + 1), String(a)), "差一点点，再算一遍"),
    ]
    return makeQuestion(rng: rng, prompt: .mixed(whole: String(Int(s + String(w)) ?? w), n: String(n), d: String(d)), requirement: "写出它的倒数", correct: frac(s + String(d), String(a)), traps: traps)
}

/* ---------------- 相反数与绝对值快闪 ---------------- */

func genOppositeAbs(_ rng: Mulberry32) -> Question {
    let v = signedTenth(rng, rng.next() < 0.25)
    let V = abs(v)
    let variant = rng.next()
    let promptText: String
    let requirement: String
    let r: Int
    let hint: String
    if variant < 0.3 {
        promptText = fmtTenth(v)
        requirement = "写出它的相反数"
        r = -v
        hint = "相反数就是符号反过来"
    } else if variant < 0.55 {
        promptText = "-(\(fmtTenth(v)))"
        requirement = "化简"
        r = -v
        hint = "括号前是负号，去掉括号要变号"
    } else if variant < 0.8 {
        promptText = "|\(fmtTenth(v))|"
        requirement = "化简"
        r = V
        hint = "绝对值是非负的"
    } else {
        promptText = "-|\(fmtTenth(v))|"
        requirement = "化简"
        r = -V
        hint = "负号在绝对值外面，结果是负的"
    }
    var traps: [Trap] = []
    pushTextTrap(&traps, -r, hint, r)
    pushTextTrap(&traps, v, "这是原数，再想想规则", r)
    fillTextTraps(&traps, r)
    return makeQuestion(rng: rng, prompt: text(promptText), requirement: requirement, correct: text(fmtTenth(r)), traps: traps)
}

/* ---------------- 正负数比大小（只同形态，不跨形态） ---------------- */

func genSignCompare(_ rng: Mulberry32) -> Question {
    let sameT = text("一样大")
    if rng.next() < 0.1 {
        // 等值不同写法：-3 vs -3.0
        var iv = Int(rng.next() * 15) - 7
        if iv == 0 { iv = 1 }
        let left = text(String(iv))
        let right = text("\(iv).0")
        let traps: [Trap] = [
            (left, "两边其实相等：3 和 3.0 一样大"),
            (right, "两边其实相等：3 和 3.0 一样大"),
        ]
        return makeQuestion(rng: rng, prompt: .vs(left: left, right: right), requirement: "哪边更大？", correct: sameT, traps: traps)
    }
    let decimal = rng.next() < 0.3
    let v1 = signedTenth(rng, decimal)
    var v2 = signedTenth(rng, decimal)
    var tries = 0
    while tries < 60 && (v1 == v2 || abs(v1 - v2) > 60) {
        v2 = signedTenth(rng, decimal)
        tries += 1
    }
    let left = text(fmtTenth(v1))
    let right = text(fmtTenth(v2))
    let bigger = v1 > v2 ? left : right
    let smaller = v1 > v2 ? right : left
    let hasNeg = v1 < 0 || v2 < 0
    let traps: [Trap] = [
        (smaller, hasNeg ? "负数比较：绝对值大的反而小" : "这个更小，再仔细比"),
        (sameT, "两边不相等，再仔细比"),
    ]
    return makeQuestion(rng: rng, prompt: .vs(left: left, right: right), requirement: "哪边更大？", correct: bigger, traps: traps)
}

/* ---------------- 乘除符号快闪：数负因数个数判正负 ---------------- */

func genSignFlashMul(_ rng: Mulberry32) -> Question {
    let cnt = 2 + Int(rng.next() * 3) // 2~4 项
    let terms = (0..<cnt).map { _ in intTenth(rng, 9) }
    let op = rng.next() < 0.7 ? "×" : "÷"
    let negCount = terms.filter { $0 < 0 }.count
    let isPos = negCount % 2 == 0
    let pos = text("正数")
    let neg = text("负数")
    let zero = text("等于 0")
    let hint = "数负数的个数：偶数个得正，奇数个得负"
    let correct = isPos ? pos : neg
    let ck = exprKey(correct)
    let traps: [Trap] = [pos, neg, zero]
        .filter { exprKey($0) != ck }
        .map { ($0, exprKey($0) == "等于 0" ? "没有 0 因数，结果不会是 0" : hint) }
    return makeQuestion(
        rng: rng,
        prompt: .op(op: op, terms: terms.map { text(fmtTenth($0)) }),
        requirement: "不计算，判断结果是正还是负",
        correct: correct,
        traps: traps
    )
}

/* ---------------- 正负数乘除（除法先定商和除数反推被除数保证整除） ---------------- */

func genSignedMulDiv(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.55 {
        // 乘法：整数 ±9 或 一位小数 × 整数
        let decimal = rng.next() < 0.25
        let a = decimal ? signedTenth(rng, true) : intTenth(rng, 9)
        let b = intTenth(rng, 9)
        let r = (a * b) / 10
        var traps: [Trap] = []
        pushTextTrap(&traps, -r, "符号规则：同号得正，异号得负", r)
        pushTextTrap(&traps, r + b, "积算错了，再算一遍", r)
        pushTextTrap(&traps, r - b, "积算错了，再算一遍", r)
        fillTextTraps(&traps, r)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "×", terms: [text(fmtTenth(a)), text(fmtTenth(b))]),
            requirement: "计算（注意正负号）",
            correct: text(fmtTenth(r)),
            traps: traps
        )
    }
    // 除法：被除数 = 除数 × 商（整数域保证整除）
    let b = intTenth(rng, 9)
    let q = intTenth(rng, 9)
    let dividend = (b * q) / 10
    var traps: [Trap] = []
    pushTextTrap(&traps, -q, "符号规则：同号得正，异号得负", q)
    pushTextTrap(&traps, q + b, "商算错了，再算一遍", q)
    pushTextTrap(&traps, q - b, "商算错了，再算一遍", q)
    fillTextTraps(&traps, q)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "÷", terms: [text(fmtTenth(dividend)), text(fmtTenth(b))]),
        requirement: "计算（注意正负号）",
        correct: text(fmtTenth(q)),
        traps: traps
    )
}

/* ---------------- Skill 定义 ---------------- */

let lcdSkill = Skill(
    id: "g6-sense-lcd",
    title: "通分快闪",
    intro: [
        "考核点：通分（异分母加减的地基，原子能力 C2）",
        "两种问法：把某一边通分后变成哪个（60%）/ 最小公分母是几（40%）",
        "通分答案不约分——就是要同分母！本题库不考加减计算",
        "倍数关系分母 50% + 互质分母 50%",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    allowUnreduced: true,
    generators: [genCommonDenom]
)

let crossCancelSkill = Skill(
    id: "g6-sense-crosscancel",
    title: "交叉约分",
    intro: [
        "考核点：乘法前先约分（分数乘法的速算地基）",
        "给出乘法式，选出约分后的式子——只约分，不算乘积",
        "技巧：一个数的分子和另一个数的分母可以互相约",
        "小心“还没约完”的选项（只约了一对）",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    supportsReview: false,
    generators: [genCrossCancel]
)

let reciprocalSkill = Skill(
    id: "g6-sense-reciprocal",
    title: "倒数快闪",
    intro: [
        "考核点：秒答倒数（除法变乘法的开关，原子能力 C4）",
        "四种形态：真分数 / 整数 / 小数 / 带分数，30% 是负数",
        "整数 k 的倒数是 1/k；带分数先化假分数再倒；负数的倒数还是负数",
        "小数记锚点：0.5↔2、0.25↔4、0.125↔8",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    allowNegative: true,
    hideMixedKey: true,
    generators: [genReciprocal]
)

let oppositeAbsSkill = Skill(
    id: "g6-sign-opposite",
    title: "相反数与绝对值",
    intro: [
        "考核点：相反数、去括号、绝对值化简（教材 1.1，原子能力 B2）",
        "四种问法：写相反数 / -(-3) 化简 / |−5| 化简 / -|−5| 化简",
        "规则：负负得正；绝对值是非负的；负号在绝对值外面结果还是负",
        "整数 75% + 一位小数 25%",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    allowNegative: true,
    numericKeypad: true,
    generators: [genOppositeAbs]
)

let signCompareSkill = Skill(
    id: "g6-sign-compare",
    title: "正负数比大小",
    intro: [
        "考核点：含负数的大小比较（教材 1.1，原子能力 B2）",
        "只出同形态比较：整数 vs 整数、一位小数 vs 一位小数",
        "核心直觉：负数比较，绝对值大的反而小（-5 < -3）",
        "一成题目两边相等（-3 和 -3.0 一样大）",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    supportsReview: false,
    generators: [genSignCompare]
)

let signFlashSkill = Skill(
    id: "g6-sign-flash",
    title: "符号快闪",
    intro: [
        "考核点：不计算，只判断正负数加减结果的正负（数感原子能力 C3）",
        "口诀：同号相加符号不变；异号相加，符号跟绝对值大的走；减负数 = 加正数",
        "约一成题目结果恰好等于 0（互为相反数）",
        "限时很短，凭直觉秒杀！本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 5,
    questionCount: 10,
    supportsReview: false,
    generators: [genSignFlash]
)

let signedAddSkill = Skill(
    id: "g6-signed-add",
    title: "正负数加减",
    intro: [
        "考核点：正负数加减速算（两项 90% + 三项代数和 10%）",
        "整数 70% + 一位小数 30%，范围 ±20；减法含“减去负数”",
        "先定符号再算绝对值：同号相加、异号抵消；减负数 = 加正数",
        "复习模式键盘有负号键，负数答案先按 − 再输数字",
    ],
    timeLimitSec: 15,
    questionCount: 10,
    allowNegative: true,
    numericKeypad: true,
    generators: [genSignedAddSub]
)

let signFlashMulSkill = Skill(
    id: "g6-sign-flash-mul",
    title: "乘除符号快闪",
    intro: [
        "考核点：不计算，判断乘除结果的正负（教材 1.3 符号规则）",
        "口诀：数负数的个数——偶数个得正，奇数个得负",
        "2~4 个数连乘或连除，“等于 0”永远是干扰项（没有 0 因数）",
        "本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 8, // 2026-10-02 从 5 秒调到 8 秒：4 项式子 5 秒读不完（女儿实测反馈）
    questionCount: 10,
    supportsReview: false,
    generators: [genSignFlashMul]
)

let signedMulSkill = Skill(
    id: "g6-signed-mul",
    title: "正负数乘除",
    intro: [
        "考核点：正负数乘除速算（教材 1.3，组合检验场）",
        "乘法 55%（整数 ±9 内，25% 一位小数×整数）+ 除法 45%（保证整除）",
        "先定符号（同号得正、异号得负），再算绝对值",
        "复习模式键盘有负号键，负数答案先按 − 再输数字",
    ],
    timeLimitSec: 12,
    questionCount: 10,
    allowNegative: true,
    numericKeypad: true,
    generators: [genSignedMulDiv]
)
