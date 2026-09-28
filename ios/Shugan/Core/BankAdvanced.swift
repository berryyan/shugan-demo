import Foundation

/**
 * 六年级 · 有理数题库（二）—— 与 bank.ts 逐行对应。
 * 乘方速记 / 分数小数混合算 / 运算顺序 / 凑整巧算
 */

/* ---------------- 乘方速记：平方 11²~20² + 立方 2³~6³ + 符号陷阱 ---------------- */

func genPowerFlash(_ rng: Mulberry32) -> Question {
    let kind = rng.next()
    if kind < 0.4 {
        let n = 11 + Int(rng.next() * 10)
        let v = n * n
        var traps: [Trap] = []
        pushTextTrap(&traps, n * 20, "平方是 n×n，不是 n×2", v * 10)
        pushTextTrap(&traps, (n - 1) * (n - 1) * 10, "记岔了：这是相邻的平方数", v * 10)
        pushTextTrap(&traps, (n + 1) * (n + 1) * 10, "记岔了：这是相邻的平方数", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text("\(n)²"), requirement: "秒答", correct: text(v), traps: traps)
    }
    if kind < 0.65 {
        let n = 2 + Int(rng.next() * 5)
        let v = n * n * n
        var traps: [Trap] = []
        pushTextTrap(&traps, n * 30, "立方是 n×n×n，不是 n×3", v * 10)
        pushTextTrap(&traps, n * n * 10, "这是平方，立方要再乘一个 n", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text("\(n)³"), requirement: "秒答", correct: text(v), traps: traps)
    }
    // 符号陷阱：负号在不在括号里，结果天差地别
    let sq = rng.next() < 0.65
    let a = sq ? 2 + Int(rng.next() * 8) : 2 + Int(rng.next() * 3)
    let inParens = rng.next() < 0.5
    if sq {
        let v = inParens ? a * a : -a * a
        var traps: [Trap] = []
        pushTextTrap(&traps, -v * 10, inParens ? "负数的平方是正数" : "负号在平方外面：先算平方再添负号", v * 10)
        pushTextTrap(&traps, (inParens ? a * 2 : -a * 2) * 10, "平方是 a×a，不是 a×2", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text(inParens ? "(-\(a))²" : "-\(a)²"), requirement: "计算（看清负号位置）", correct: text(v), traps: traps)
    }
    let v = -a * a * a
    var traps: [Trap] = []
    pushTextTrap(&traps, -v * 10, "负数的立方还是负数（三个负号）", v * 10)
    pushTextTrap(&traps, a * 30, "立方是 a×a×a，不是 a×3", v * 10)
    fillTextTraps(&traps, v * 10)
    return makeQuestion(rng: rng, prompt: text("(-\(a))³"), requirement: "计算（看清符号）", correct: text(v), traps: traps)
}

/* ---------------- 分数+小数混合四则（有理数精确计算，答案择优呈现） ---------------- */

func genFracDecMix(_ rng: Mulberry32) -> Question {
    let anchor = pick(rng, DEC_ANCHORS)
    let (decS, dn, dd) = (anchor.0, anchor.1, anchor.2)
    let b = pick(rng, [2, 3, 4, 5, 6, 8, 9])
    let an = randomNumerator(rng, b)
    let F = (an, b)
    let D = (dn, dd)
    var op = pick(rng, ["+", "-", "×", "÷"])
    var terms: [MathExpr] = []
    var res = (0, 1)
    var swapped = false
    if op == "-" && abs(rVal(F) - rVal(D)) < 1e-9 { op = "+" } // 相等相减得 0 没意义，改加法
    if op == "+" {
        terms = [frac(an, b), text(decS)]
        res = rAdd(F, D)
    } else if op == "×" {
        terms = [frac(an, b), text(decS)]
        res = rMul(F, D)
    } else if op == "-" {
        if rVal(F) >= rVal(D) {
            terms = [frac(an, b), text(decS)]
            res = rSub(F, D)
        } else {
            terms = [text(decS), frac(an, b)]
            res = rSub(D, F)
            swapped = true
        }
    } else {
        if rng.next() < 0.5 {
            terms = [frac(an, b), text(decS)]
            res = rDiv(F, D)
        } else {
            terms = [text(decS), frac(an, b)]
            res = rDiv(D, F)
            swapped = true
        }
    }
    let ans = fmtRat(res)
    let ansKey = exprKey(ans)
    var traps: [Trap] = []
    var seen = Set<String>([ansKey])
    func pushRat(_ x: (Int, Int), _ trap: String) {
        if x.0 <= 0 { return }
        let t = fmtRat(x)
        let k = exprKey(t)
        if seen.contains(k) { return }
        seen.insert(k)
        traps.append((t, trap))
    }
    // 误区 1：除法/减法方向反了
    if op == "÷" { pushRat(swapped ? rDiv(F, D) : rDiv(D, F), "被除数和除数的位置要看清") }
    if op == "-" { pushRat(swapped ? rSub(F, D) : rSub(D, F), "谁减谁要看清（本题结果为正）") }
    // 误区 2：小数转换记错（0.25 当成 1/5 之类）
    if let wa = WRONG_ANCHOR[decS] {
        let W = wa
        let wrongRes = op == "+" ? rAdd(F, W) : op == "×" ? rMul(F, W) : op == "-" ? rSub(F, W) : rDiv(F, W)
        pushRat(wrongRes, "小数转分数记错了：\(decS) 不是 \(wa.0)/\(wa.1)")
    }
    // 误区 3：运算符号看错（换一种运算的结果）
    let altOp = pick(rng, ["+", "-", "×", "÷"].filter { $0 != op })
    let alt = altOp == "+" ? rAdd(F, D) : altOp == "×" ? rMul(F, D) : altOp == "-" ? rSub(F, D) : rDiv(F, D)
    pushRat(alt, "这是按 \(altOp) 算的，看清运算符号")
    // 兜底：邻值
    for c in [(res.0 + 1, res.1), (res.0 - 1, res.1), (res.0, res.1 + 1), (res.0 * 2, res.1), (res.0 + 2, res.1)] {
        if traps.count >= 3 { break }
        if c.0 <= 0 || c.1 < 1 { continue }
        pushRat(c, "差一点点，再仔细算一遍")
    }
    return makeQuestion(
        rng: rng,
        prompt: .op(op: op, terms: terms),
        requirement: "计算（结果约到最简，假分数或带分数均可）",
        correct: ans,
        traps: traps
    )
}

/* ---------------- 运算顺序：只问"先算哪一步" ---------------- */

func genOpOrder(_ rng: Mulberry32) -> Question {
    // 4 个互不相同的数（保持插入顺序，与 TS Set 一致）
    var nums: [Int] = []
    while nums.count < 4 {
        let v = 2 + Int(rng.next() * 14)
        if !nums.contains(v) { nums.append(v) }
    }
    let A = nums[0], B = nums[1], C = nums[2], D = nums[3]
    let form = Int(rng.next() * 6)
    let expr: String
    let step: String
    var traps: [Trap] = []
    switch form {
    case 0:
        expr = "\(A) + \(B) × \(C)"
        step = "\(B) × \(C)"
        traps = [
            (text("\(A) + \(B)"), "先乘除后加减：乘法是 B 和 C 之间的"),
            (text("\(A) + \(C)"), "乱配了：乘法在中间的 B 和 C 之间"),
            (text("\(B) + \(C)"), "符号看错了，中间是乘号"),
        ]
    case 1:
        expr = "\(A) - \(B) ÷ \(C)"
        step = "\(B) ÷ \(C)"
        traps = [
            (text("\(A) - \(B)"), "先乘除后加减：除法是 B 和 C 之间的"),
            (text("\(A) ÷ \(C)"), "乱配了：除法在 B 和 C 之间"),
            (text("\(B) - \(C)"), "符号看错了，中间是除号"),
        ]
    case 2:
        expr = "(\(A) + \(B)) × \(C)"
        step = "\(A) + \(B)"
        traps = [
            (text("\(B) × \(C)"), "括号里的要最先算"),
            (text("\(A) × \(C)"), "乱配了：括号优先"),
            (text("\(B) + \(C)"), "括号优先，先算括号里面"),
        ]
    case 3:
        expr = "\(A) × (\(B) - \(C))"
        step = "\(B) - \(C)"
        traps = [
            (text("\(A) × \(B)"), "括号里的要最先算"),
            (text("\(A) - \(C)"), "乱配了：括号优先"),
            (text("\(B) × \(C)"), "符号看错了，括号里是减号"),
        ]
    case 4:
        expr = "\(A) ÷ \(B) × \(C)"
        step = "\(A) ÷ \(B)"
        traps = [
            (text("\(B) × \(C)"), "乘除同级要从左往右算"),
            (text("\(A) × \(C)"), "乱配了：同级从左往右"),
            (text("\(A) ÷ \(C)"), "乱配了：同级从左往右"),
        ]
    default:
        expr = "\(A) + \(B) - \(C) + \(D)"
        step = "\(A) + \(B)"
        traps = [
            (text("\(B) - \(C)"), "加减同级要从左往右，第一步在最左边"),
            (text("\(C) + \(D)"), "加减同级要从左往右，第一步在最左边"),
            (text("\(A) + \(C)"), "乱配了：同级从左往右"),
        ]
    }
    return makeQuestion(rng: rng, prompt: text(expr), requirement: "先算哪一步？", correct: text(step), traps: traps)
}

/* ---------------- 凑整巧算：选最聪明的第一步 / 凑整求值 ---------------- */

func genOpLaws(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.4 {
        let PAIRS = [("0.25", "4"), ("2.5", "4"), ("0.125", "8"), ("25", "4"), ("125", "8"), ("0.5", "2")]
        let pair = pick(rng, PAIRS)
        let xs = pair.0
        let ys = pair.1
        // 中间乘数不能和凑整对撞车
        let banned = Set([Double(xs) ?? 0, Double(ys) ?? 0])
        var a = 3 + Int(rng.next() * 30)
        var tries = 0
        while tries < 40 && banned.contains(Double(a)) {
            a = 3 + Int(rng.next() * 30)
            tries += 1
        }
        if banned.contains(Double(a)) { a = 33 }
        let traps: [Trap] = [
            (text("\(xs) × \(a)"), "按顺序硬算第一步，慢还容易错"),
            (text("\(a) × \(ys)"), "这一步凑不出整：找乘起来是整十整百的两个数"),
            (text("\(xs) + \(ys)"), "是连乘不是加法"),
        ]
        return makeQuestion(
            rng: rng,
            prompt: text("\(xs) × \(a) × \(ys)"),
            requirement: "怎么算最快？第一步选哪个",
            correct: text("\(xs) × \(ys)"),
            traps: traps
        )
    }
    let t = rng.next()
    if t < 0.2 {
        let k = 3 + Int(rng.next() * 10)
        let v = 100 * k
        var traps: [Trap] = []
        pushTextTrap(&traps, 100 * (k - 1) * 10, "少数了一组 25×4=100", v * 10)
        pushTextTrap(&traps, 100 * (k + 1) * 10, "多数了一组 25×4=100", v * 10)
        pushTextTrap(&traps, (v - 50) * 10, "把 32 拆成 4×8 再算：25×4=100", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text("25 × \(4 * k)"), requirement: "计算（凑整最快）", correct: text(v), traps: traps)
    }
    if t < 0.4 {
        let k = 2 + Int(rng.next() * 5)
        let v = 1000 * k
        var traps: [Trap] = []
        pushTextTrap(&traps, 1000 * (k - 1) * 10, "少数了一组 125×8=1000", v * 10)
        pushTextTrap(&traps, 1000 * (k + 1) * 10, "多数了一组 125×8=1000", v * 10)
        pushTextTrap(&traps, (v - 500) * 10, "把乘数拆出 8：125×8=1000", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text("125 × \(8 * k)"), requirement: "计算（凑整最快）", correct: text(v), traps: traps)
    }
    if t < 0.65 {
        let near100 = rng.next() < 0.5 ? 99 : 101
        let m = 3 + Int(rng.next() * 7)
        let v = near100 * m
        var traps: [Trap] = []
        pushTextTrap(&traps, 100 * m * 10, near100 == 99 ? "99×m = 100×m − m，还要减一个 m" : "101×m = 100×m + m，还要加一个 m", v * 10)
        pushTextTrap(&traps, (near100 == 99 ? 98 * m : 102 * m) * 10, near100 == 99 ? "多减了一个 m" : "多加了一个 m", v * 10)
        pushTextTrap(&traps, 90 * m * 10, "把接近 100 的数当 100 算再调整", v * 10)
        fillTextTraps(&traps, v * 10)
        return makeQuestion(rng: rng, prompt: text("\(near100) × \(m)"), requirement: "计算（凑整最快）", correct: text(v), traps: traps)
    }
    if t < 0.85 {
        // 小数凑整加法：a + b + c，其中 a + c 凑整
        let PAIRS: [(Int, Int)] = [(46, 54), (88, 12), (125, 75), (37, 63), (99, 1), (25, 75)]
        let pair = pick(rng, PAIRS)
        let x = pair.0
        let z = pair.1
        let y = 11 + Int(rng.next() * 88) // 1.1~9.8
        let v = x + y + z // 十分位整数
        var traps: [Trap] = []
        pushTextTrap(&traps, v - 10, "小数点对齐错，差 1", v)
        pushTextTrap(&traps, v + 10, "小数点对齐错，差 1", v)
        pushTextTrap(&traps, x + z + y - 2, "进位算错了", v)
        fillTextTraps(&traps, v)
        return makeQuestion(
            rng: rng,
            prompt: text("\(fmtTenth(x)) + \(fmtTenth(y)) + \(fmtTenth(z))"),
            requirement: "计算（先找能凑整的两个数）",
            correct: text(fmtTenth(v)),
            traps: traps
        )
    }
    // 198 补整加法：把 198 当 200 加，再减 2
    let base = pick(rng, [198, 298, 397, 495, 599, 697])
    let gap: Int
    if base % 100 == 99 || base % 100 == 95 {
        gap = 100 - (base % 100)
    } else if base % 100 == 97 {
        gap = 3
    } else {
        gap = 100 - (base % 100)
    }
    let round = base + gap // 最近的整百
    let m = 20 + Int(rng.next() * 70)
    let v = base + m
    var traps: [Trap] = []
    pushTextTrap(&traps, (round + m) * 10, "把 \(base) 当 \(round) 加了，别忘了再减 \(gap)", v * 10)
    pushTextTrap(&traps, (round + m - 2 * gap) * 10, "调整方向反了", v * 10)
    pushTextTrap(&traps, (v + 10) * 10, "十位进位算错了", v * 10)
    fillTextTraps(&traps, v * 10)
    return makeQuestion(rng: rng, prompt: text("\(base) + \(m)"), requirement: "计算（凑整最快）", correct: text(v), traps: traps)
}

/* ---------------- Skill 定义 ---------------- */

let powerFlashSkill = Skill(
    id: "g6-power-flash",
    title: "乘方速记",
    intro: [
        "考核点：平方/立方秒答 + 负号位置辨析（教材 1.4）",
        "平方 11²~20²（40%）、立方 2³~6³（25%）",
        "符号陷阱 35%：(-3)² = 9 但 -3² = -9，负号在括号外先算平方！",
        "复习模式键盘有负号键",
    ],
    timeLimitSec: 6,
    questionCount: 10,
    allowNegative: true,
    numericKeypad: true,
    generators: [genPowerFlash]
)

let fracDecMixSkill = Skill(
    id: "g6-frac-dec-mix",
    title: "分数小数混合算",
    intro: [
        "考核点：分数与小数的混合四则（教材 1.5，组合检验场）",
        "加/减/乘/除各 25%，两项计算；小数全部来自锚点表（0.125~2.5）",
        "答案自动选最好看的形态：能写小数写小数，否则最简分数/带分数",
        "减法保证结果为正；小心“方向反了”和“0.25 记成 1/5”的干扰项",
    ],
    timeLimitSec: 18,
    questionCount: 10,
    acceptImproper: true,
    generators: [genFracDecMix]
)

let opOrderSkill = Skill(
    id: "g6-op-order",
    title: "运算顺序",
    intro: [
        "考核点：只判断“先算哪一步”，不计算（教材 1.5）",
        "三条规则：括号优先 → 先乘除后加减 → 同级从左往右",
        "干扰项都是“看起来顺手”的错误第一步",
        "本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 8,
    questionCount: 10,
    supportsReview: false,
    generators: [genOpOrder]
)

let opLawsSkill = Skill(
    id: "g6-op-laws",
    title: "凑整巧算",
    intro: [
        "考核点：选最聪明的算法，不硬算（运算律运用）",
        "40% 选第一步：连乘里找乘起来是整十整百的两个数（0.25×4、125×8）",
        "60% 凑整求值：25×32、99×7、4.6+5.7+5.4、198+76",
        "本题型只有闯关和进阶两种模式",
    ],
    timeLimitSec: 10,
    questionCount: 10,
    supportsReview: false,
    generators: [genOpLaws]
)
