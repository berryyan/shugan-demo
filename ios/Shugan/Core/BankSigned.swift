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

/* ---------------- 六年级 · 有理数：负分数（分数线 × 负号线交叉，2026-10-17 新增） ----------------
 * 与 bank.ts 同名生成器逐行对应。负分数一律用 frac("-n","d")（负号在分子里）表示，
 * 渲染层把负号前置到分数线左边并标红。id 统一 g6-signed-frac- 前缀。
 */

/** 带符号运算结果 → MathExpr：整数 → text；其余 → 最简分数（负号在分子）；不产生带分数 */
func sAnsExpr(_ n: Int, _ d: Int) -> MathExpr {
    let (rn, rd) = reduce2(n, d)
    if rn % rd == 0 { return text(rn / rd) }
    return frac(rn, rd)
}

/** 需要"两个不同分子"的同分母分支专用分母表：剔除 2（最简分子只有 1 个，抽不出两个） */
let SIGNED_PAIR_DENOMS = [3, 4, 5, 6, 8]

/** 带符号形态陷阱：可约分时出"未约分等价"（数值故意相等）。gcd 对负 N 失效（返回负），用绝对值判断 */
func sFormTraps(_ traps: inout [Trap], _ N: Int, _ D: Int) {
    if gcd(abs(N), abs(D)) > 1 {
        traps.append((frac(N, D), "数值相等但没有约成最简，还要继续约分"))
    }
}

/** 负分数比大小（三选一 vs 题）：负vs负 40%（同分子/同分母各半）/ 负分数vs负小数 25% / 正vs负 20% / 等值变形 15% */
func genSignedFracCmp(_ rng: Mulberry32) -> Question {
    let sameT = text("一样大")
    let r0 = rng.next()
    if r0 < 0.15 {
        // 等值变形：-1/2 vs -0.5（小数转换是已训练的原子能力，这里考"负号不改变相等关系"）
        let d = pick(rng, DECIMAL_OK)
        let n = randomNumerator(rng, d)
        let f = frac(-n, d)
        let t = text("-" + fracToDecimalText(n, d))
        let traps: [Trap] = [
            (f, "两边其实相等：1/2 就是 0.5，负号不改变大小关系"),
            (t, "两边其实相等：1/2 就是 0.5，负号不改变大小关系"),
        ]
        return makeQuestion(rng: rng, prompt: .vs(left: f, right: t), requirement: "哪边更大？", correct: sameT, traps: traps)
    }
    if r0 < 0.55 {
        // 负 vs 负：同分子（分母大的反而小）/ 同分母（分子大的反而小）各半
        var n1 = 0, n2 = 0, d1 = 0, d2 = 0
        if rng.next() < 0.5 {
            d1 = pick(rng, ARITH_DENOMS)
            d2 = pick(rng, ARITH_DENOMS)
            var tries = 0
            while tries < 60 && d2 == d1 {
                d2 = pick(rng, ARITH_DENOMS)
                tries += 1
            }
            let lo = min(d1, d2)
            let cands = coprimeNumerators(lo).filter { gcd($0, d1) == 1 && gcd($0, d2) == 1 }
            n1 = pick(rng, cands)
            n2 = n1
        } else {
            let dd = pick(rng, SIGNED_PAIR_DENOMS)
            d1 = dd
            d2 = dd
            n1 = randomNumerator(rng, d1)
            n2 = randomNumerator(rng, d1, exclude: n1)
        }
        let left = frac(-n1, d1)
        let right = frac(-n2, d2)
        let leftBigger = -Double(n1) / Double(d1) > -Double(n2) / Double(d2)
        let bigger = leftBigger ? left : right
        let smaller = leftBigger ? right : left
        let traps: [Trap] = [
            (smaller, "负数比较：绝对值大的反而小"),
            (sameT, "两边不相等，再仔细比"),
        ]
        return makeQuestion(rng: rng, prompt: .vs(left: left, right: right), requirement: "哪边更大？", correct: bigger, traps: traps)
    }
    if r0 < 0.8 {
        // 负分数 vs 负小数：值接近但不同（差 0.05~0.2），必须先统一形态再比
        let d = pick(rng, DECIMAL_OK)
        let n = randomNumerator(rng, d)
        let fMilli = n * (1000 / d)
        let delta = pick(rng, [50, 100, 150, 200])
        let up = rng.next() < 0.5
        let gMilli = up ? min(950, fMilli + delta) : max(50, fMilli - delta)
        let f = frac(-n, d)
        let t = text("-" + fracToDecimalText(gMilli, 1000))
        let fracLeft = rng.next() < 0.5
        let left = fracLeft ? f : t
        let right = fracLeft ? t : f
        let fracBigger = -Double(n) / Double(d) > -Double(gMilli) / 1000
        let bigger = fracBigger ? f : t
        let smaller = fracBigger ? t : f
        let traps: [Trap] = [
            (smaller, "负数比较：绝对值大的反而小；先统一成分数或小数再比"),
            (sameT, "两边不相等，差了不到 0.2，仔细转换再比"),
        ]
        return makeQuestion(rng: rng, prompt: .vs(left: left, right: right), requirement: "哪边更大？", correct: bigger, traps: traps)
    }
    // 正 vs 负：正数永远更大（秒答题，建立符号直觉）
    let d1 = pick(rng, ARITH_DENOMS)
    let n1 = randomNumerator(rng, d1)
    let d2 = pick(rng, ARITH_DENOMS)
    let n2 = randomNumerator(rng, d2)
    let posE = frac(n1, d1)
    let negE = frac(-n2, d2)
    let negLeft = rng.next() < 0.5
    let left = negLeft ? negE : posE
    let right = negLeft ? posE : negE
    let traps: [Trap] = [
        (negE, "正数永远比负数大"),
        (sameT, "一正一负不会相等"),
    ]
    return makeQuestion(rng: rng, prompt: .vs(left: left, right: right), requirement: "哪边更大？", correct: posE, traps: traps)
}

/** 分数符号快闪（三选一）：相反数得 0 12%；其余同分母带符号相加 / 异分母正数相减各半 */
func genSignedFracFlash(_ rng: Mulberry32) -> Question {
    let pos = text("正数")
    let neg = text("负数")
    let zero = text("等于 0")
    let hint = "先估绝对值：同分母比分子，异分母先通分再比；符号跟绝对值大的走"
    let r0 = rng.next()
    if r0 < 0.12 {
        // 互为相反数：n/d + (-n/d) = 0
        let d = pick(rng, ARITH_DENOMS)
        let n = randomNumerator(rng, d)
        let first = rng.next() < 0.5
        let f1 = frac(n, d)
        let f2 = frac(-n, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: first ? [f2, f1] : [f1, f2]),
            requirement: "不计算，判断结果是正还是负",
            correct: zero,
            traps: [
                (pos, "这两个数互为相反数，相加等于 0"),
                (neg, "这两个数互为相反数，相加等于 0"),
            ]
        )
    }
    if r0 < 0.56 {
        // 同分母带符号相加：一正一负，判号 = 比分子大小（排除相等，不会恰为 0）
        let d = pick(rng, SIGNED_PAIR_DENOMS)
        let n1 = randomNumerator(rng, d)
        let n2 = randomNumerator(rng, d, exclude: n1)
        let negFirst = rng.next() < 0.5
        let terms = negFirst ? [frac(-n1, d), frac(n2, d)] : [frac(n1, d), frac(-n2, d)]
        let v = negFirst ? n2 - n1 : n1 - n2
        let correct = v > 0 ? pos : neg
        let ck = exprKey(correct)
        let traps: [Trap] = [pos, neg, zero]
            .filter { exprKey($0) != ck }
            .map { ($0, exprKey($0) == "等于 0" ? "两个分子不一样大，不会等于 0" : hint) }
        return makeQuestion(rng: rng, prompt: .op(op: "+", terms: terms), requirement: "不计算，判断结果是正还是负", correct: correct, traps: traps)
    }
    // 异分母正数相减：n1/d1 - n2/d2，要先通分才知道谁大（排除等值）
    let p = pick(rng, MULTIPLE_PAIRS + COPRIME_PAIRS)
    let d1 = p.0
    let d2 = p.1
    let n1 = randomNumerator(rng, d1)
    var n2 = randomNumerator(rng, d2)
    var tries = 0
    while tries < 60 && n1 * d2 == n2 * d1 {
        n2 = randomNumerator(rng, d2)
        tries += 1
    }
    let v = n1 * d2 - n2 * d1
    let correct = v > 0 ? pos : neg
    let ck = exprKey(correct)
    let traps: [Trap] = [pos, neg, zero]
        .filter { exprKey($0) != ck }
        .map { ($0, exprKey($0) == "等于 0" ? "通分后分子不一样大，不会等于 0" : hint) }
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "-", terms: [frac(n1, d1), frac(n2, d2)]),
        requirement: "不计算，判断结果是正还是负",
        correct: correct,
        traps: traps
    )
}

/** 分数正负加减·基础：同分母带符号 45% + 倍数分母 30% + 不够减（结果为负）25% */
func genSignedFracBasic(_ rng: Mulberry32) -> Question {
    let r0 = rng.next()
    if r0 < 0.45 {
        // 同分母带符号：通分零负担，专注符号规则
        let d = pick(rng, SIGNED_PAIR_DENOMS)
        let n1 = randomNumerator(rng, d)
        let n2 = randomNumerator(rng, d, exclude: n1)
        let s1 = rng.next() < 0.5 ? 1 : -1
        let s2 = rng.next() < 0.5 ? 1 : -1
        let isSub = rng.next() < 0.5
        let e2 = isSub ? -s2 : s2 // 第二项实际参与运算的符号
        let N = s1 * n1 + e2 * n2
        let correctVal = Double(N) / Double(d)
        var traps: [Trap] = []
        pushTrap(&traps, sAnsExpr(-N, d), "符号看反了", correctVal)
        pushTrap(&traps, sAnsExpr(s1 * n1 - e2 * n2, d), isSub ? "减去一个数 = 加上它的相反数，符号要变" : "加负数 = 减正数，符号看错了", correctVal)
        pushTrap(&traps, sAnsExpr(n1 + n2, d), "异号相加是绝对值抵消，不是相加", correctVal)
        sFormTraps(&traps, N, d)
        fillTraps(&traps, N, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: isSub ? "-" : "+", terms: [frac(s1 * n1, d), frac(s2 * n2, d)]),
            requirement: "计算（注意正负号）",
            correct: sAnsExpr(N, d),
            traps: traps
        )
    }
    if r0 < 0.75 {
        // 倍数分母带符号：通分是小倍数，专注符号
        let p = pick(rng, MULTIPLE_PAIRS)
        let d1 = p.0
        let d2 = p.1
        let n1 = randomNumerator(rng, d1)
        let n2 = randomNumerator(rng, d2)
        let s1 = rng.next() < 0.5 ? 1 : -1
        let s2 = rng.next() < 0.5 ? 1 : -1
        let isSub = rng.next() < 0.5
        let e2 = isSub ? -s2 : s2
        let D = lcm(d1, d2)
        let m1 = n1 * (D / d1)
        let m2 = n2 * (D / d2)
        let N = s1 * m1 + e2 * m2
        let correctVal = Double(N) / Double(D)
        var traps: [Trap] = []
        pushTrap(&traps, sAnsExpr(-N, D), "符号看反了", correctVal)
        pushTrap(&traps, sAnsExpr(s1 * m1 - e2 * m2, D), isSub ? "减去一个数 = 加上它的相反数，符号要变" : "加负数 = 减正数，符号看错了", correctVal)
        pushTrap(&traps, sAnsExpr(s1 * n1 + e2 * n2, D), "通分后分子也要乘同样的倍数", correctVal)
        sFormTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: isSub ? "-" : "+", terms: [frac(s1 * n1, d1), frac(s2 * n2, d2)]),
            requirement: "计算（注意正负号）",
            correct: sAnsExpr(N, D),
            traps: traps
        )
    }
    // 不够减专项：正数 − 正数，结果为负（小学从未见过的结构，初中第一道坎）
    let q = pickAddSubPair(rng)
    let swap = q.n1 * q.d2 > q.n2 * q.d1
    let a1 = swap ? q.n2 : q.n1
    let b1 = swap ? q.d2 : q.d1
    let a2 = swap ? q.n1 : q.n2
    let b2 = swap ? q.d1 : q.d2
    let D = lcm(b1, b2)
    let N = a1 * (D / b1) - a2 * (D / b2) // ≤ 0
    let correctVal = Double(N) / Double(D)
    var traps: [Trap] = []
    pushTrap(&traps, sAnsExpr(-N, D), "不够减时结果是负数：小数减大数，差的前面加负号，不是倒过来减", correctVal)
    pushTrap(&traps, sAnsExpr(a1 * (D / b1) + a2 * (D / b2), D), "把减法算成加法了", correctVal)
    pushTrap(&traps, sAnsExpr(N + 1, D), "分子减错了，再算一遍", correctVal)
    sFormTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "-", terms: [frac(a1, b1), frac(a2, b2)]),
        requirement: "计算（注意正负号）",
        correct: sAnsExpr(N, D),
        traps: traps
    )
}

/** 分数正负混合·进阶：互质异号相加 40% + 减负数 30% + 小数分数混合 20% + 三项代数和 10% */
func genSignedFracAdv(_ rng: Mulberry32) -> Question {
    let r0 = rng.next()
    if r0 < 0.4 {
        // 互质分母严格异号相加：一正一负，考"抵消 + 符号跟绝对值大的走"
        let p = pick(rng, COPRIME_PAIRS)
        let d1 = p.0
        let d2 = p.1
        let n1 = randomNumerator(rng, d1)
        let n2 = randomNumerator(rng, d2)
        let negFirst = rng.next() < 0.5
        let D = lcm(d1, d2)
        let m1 = n1 * (D / d1)
        let m2 = n2 * (D / d2)
        let N = negFirst ? -m1 + m2 : m1 - m2
        let correctVal = Double(N) / Double(D)
        var traps: [Trap] = []
        pushTrap(&traps, sAnsExpr(m1 + m2, D), "异号相加是绝对值抵消，不是相加", correctVal)
        pushTrap(&traps, sAnsExpr(-m1 - m2, D), "异号相加是绝对值抵消，不是相加", correctVal)
        pushTrap(&traps, sAnsExpr(-N, D), "符号看反了：跟绝对值大的数走", correctVal)
        sFormTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: [frac(negFirst ? -n1 : n1, d1), frac(negFirst ? n2 : -n2, d2)]),
            requirement: "计算（注意正负号）",
            correct: sAnsExpr(N, D),
            traps: traps
        )
    }
    if r0 < 0.7 {
        // 减负数：正 − 负 = 相加、负 − 正 = 负的相加，各半
        let p = pick(rng, MULTIPLE_PAIRS + COPRIME_PAIRS)
        let d1 = p.0
        let d2 = p.1
        let n1 = randomNumerator(rng, d1)
        let n2 = randomNumerator(rng, d2)
        let posMinusNeg = rng.next() < 0.5
        let D = lcm(d1, d2)
        let m1 = n1 * (D / d1)
        let m2 = n2 * (D / d2)
        let N = posMinusNeg ? m1 + m2 : -m1 - m2
        let correctVal = Double(N) / Double(D)
        var traps: [Trap] = []
        pushTrap(&traps, sAnsExpr(posMinusNeg ? m1 - m2 : -m1 + m2, D), "减负数 = 加正数，符号要变", correctVal)
        pushTrap(&traps, sAnsExpr(posMinusNeg ? -m1 + m2 : m1 - m2, D), "减负数 = 加正数，符号要变", correctVal)
        pushTrap(&traps, sAnsExpr(-N, D), "符号看反了", correctVal)
        sFormTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        let terms = posMinusNeg ? [frac(n1, d1), frac(-n2, d2)] : [frac(-n1, d1), frac(n2, d2)]
        return makeQuestion(rng: rng, prompt: .op(op: "-", terms: terms), requirement: "计算（注意正负号）", correct: sAnsExpr(N, D), traps: traps)
    }
    if r0 < 0.9 {
        // 小数分数混合带符号：小数来自 DEC_ANCHORS 加负号，分数带符号（转换是已训练的原子能力）
        let anchor = pick(rng, DEC_ANCHORS)
        let decS = anchor.0
        let dn = anchor.1
        let dd = anchor.2
        let d = pick(rng, ARITH_DENOMS)
        let n = randomNumerator(rng, d)
        let decNeg = rng.next() < 0.5
        let fracNeg = rng.next() < 0.5
        let isSub = rng.next() < 0.5
        let D = lcm(dd, d)
        let sD = decNeg ? -1 : 1
        let eF = (fracNeg ? -1 : 1) * (isSub ? -1 : 1) // 分数项实际参与运算的符号
        let N = sD * dn * (D / dd) + eF * n * (D / d)
        let correctVal = Double(N) / Double(D)
        var traps: [Trap] = []
        pushTrap(&traps, sAnsExpr(-N, D), "符号看反了", correctVal)
        pushTrap(&traps, sAnsExpr(sD * dn * (D / dd) - eF * n * (D / d), D), isSub ? "减去一个数 = 加上它的相反数，符号要变" : "加负数 = 减正数，符号看错了", correctVal)
        pushTrap(&traps, sAnsExpr(sD * dn * (D / dd) + eF * n, D), "通分后分子也要乘同样的倍数", correctVal)
        sFormTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: isSub ? "-" : "+", terms: [text(decNeg ? "-" + decS : decS), frac(fracNeg ? -n : n, d)]),
            requirement: "计算（注意正负号）",
            correct: sAnsExpr(N, D),
            traps: traps
        )
    }
    // 三项代数和：分母组合 [2,3,4] [2,3,6] [3,4,6] [2,4,8]，公分母 ≤ 12
    let ds = pick(rng, [[2, 3, 4], [2, 3, 6], [3, 4, 6], [2, 4, 8]])
    let n1 = randomNumerator(rng, ds[0])
    let n2 = randomNumerator(rng, ds[1])
    let n3 = randomNumerator(rng, ds[2])
    let s1 = rng.next() < 0.5 ? 1 : -1
    let s2 = rng.next() < 0.5 ? 1 : -1
    let s3 = rng.next() < 0.5 ? 1 : -1
    let D = lcm(lcm(ds[0], ds[1]), ds[2])
    let m1 = n1 * (D / ds[0])
    let m2 = n2 * (D / ds[1])
    let m3 = n3 * (D / ds[2])
    let N = s1 * m1 + s2 * m2 + s3 * m3
    let correctVal = Double(N) / Double(D)
    var traps: [Trap] = []
    pushTrap(&traps, sAnsExpr(-N, D), "符号看反了", correctVal)
    pushTrap(&traps, sAnsExpr(s1 * m1 + s2 * m2 - s3 * m3, D), "最后一项的符号看错了", correctVal)
    pushTrap(&traps, sAnsExpr((m1 + m2 + m3) * (N >= 0 ? -1 : 1), D), "不能全当同号相加，负项要抵消", correctVal)
    sFormTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "+", terms: [frac(s1 * n1, ds[0]), frac(s2 * n2, ds[1]), frac(s3 * n3, ds[2])]),
        requirement: "计算（注意正负号）",
        correct: sAnsExpr(N, D),
        traps: traps
    )
}

/* ---------------- 负分数 Skill 定义 ---------------- */

let signedFracCmpSkill = Skill(
    id: "g6-signed-frac-cmp",
    title: "负分数比大小",
    intro: [
        "考核点：含负分数的大小比较（教材 1.1 延伸，原子能力 B2 进阶）",
        "核心直觉：负数比较，绝对值大的反而小（-1/2 < -1/3）",
        "含负分数 vs 负小数（先统一形态再比）与等值变形（-1/2 和 -0.5 一样大）",
        "本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    supportsReview: false,
    generators: [genSignedFracCmp]
)

let signedFracFlashSkill = Skill(
    id: "g6-signed-frac-flash",
    title: "分数符号快闪",
    intro: [
        "考核点：不计算，判断分数加减结果的正负（原子能力 C3 进阶）",
        "先估绝对值：同分母比分子，异分母先通分再比；符号跟绝对值大的走",
        "约一成题目互为相反数，结果等于 0",
        "本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 5,
    questionCount: 10,
    supportsReview: false,
    generators: [genSignedFracFlash]
)

let signedFracBasicSkill = Skill(
    id: "g6-signed-frac-basic",
    title: "分数正负加减·基础",
    intro: [
        "考核点：带符号分数加减（同分母 45% + 倍数分母 30% + 不够减 25%）",
        "先定符号再算绝对值；不够减时结果是负数（小数减大数，差的前面加负号）",
        "答案要约到最简；复习模式键盘有负号键，负数答案先按 − 再输数字",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    allowNegative: true,
    acceptImproper: true,
    hideMixedKey: true,
    generators: [genSignedFracBasic]
)

let signedFracAdvSkill = Skill(
    id: "g6-signed-frac-adv",
    title: "分数正负混合·进阶",
    intro: [
        "考核点：互质分母异号相加 40% + 减负数 30% + 小数分数混合 20% + 三项代数和 10%",
        "口诀：减去负数 = 加正数；异号相加，符号跟绝对值大的走",
        "小数都来自常考锚点（0.5、0.25、0.125……），先转换再算",
        "复习模式键盘有负号键，负数答案先按 − 再输数字",
    ],
    timeLimitSec: 14,
    questionCount: 10,
    allowNegative: true,
    acceptImproper: true,
    hideMixedKey: true,
    generators: [genSignedFracAdv]
)
