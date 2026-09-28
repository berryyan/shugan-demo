import Foundation

/**
 * 五年级 · 分数运算题库 —— 与 bank.ts 逐行对应。
 * 分数加法 / 减法 / 乘法 / 除法：两项 90% + 三项连算 10%，答案最简、>1 写带分数。
 */

/** 分数加法：干扰项 = 分母也加/分子忘乘倍数/把加法算成乘法 + 形态陷阱 */
func genFracAdd(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.1 {
        // 三项同分母连加
        let d = pick(rng, ARITH_DENOMS)
        let ns = [randomNumerator(rng, d), randomNumerator(rng, d), randomNumerator(rng, d)]
        let N = ns[0] + ns[1] + ns[2]
        var traps: [Trap] = [
            (frac(N, d * 3), "同分母连加，分母不变，不是把分母也加起来"),
            (frac(N - 1, d), "漏加了一个分子，再数一数"),
            (frac(N + 1, d), "分子加错了，再算一遍"),
        ]
        formTraps(&traps, N, d)
        fillTraps(&traps, N, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "+", terms: ns.map { frac($0, d) }),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, d),
            traps: traps
        )
    }
    let p = pickAddSubPair(rng)
    let D = lcm(p.d1, p.d2)
    let N = p.n1 * (D / p.d1) + p.n2 * (D / p.d2)
    var traps: [Trap] = []
    if p.d1 == p.d2 {
        pushTrap(&traps, frac(N, p.d1 * 2), "同分母相加，分母不变，不是把分母也加起来", Double(N) / Double(D))
        pushTrap(&traps, frac(N + 1, p.d1), "分子加错了，再算一遍", Double(N) / Double(D))
    } else {
        pushTrap(&traps, frac(p.n1 + p.n2, p.d1 + p.d2), "异分母相加要先通分，不能把分子分母分别相加", Double(N) / Double(D))
        pushTrap(&traps, frac(p.n1 + p.n2, D), "通分后分子也要乘同样的倍数", Double(N) / Double(D))
    }
    pushTrap(&traps, ansExpr(p.n1 * p.n2, p.d1 * p.d2), "把加法算成乘法了", Double(N) / Double(D))
    formTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "+", terms: [frac(p.n1, p.d1), frac(p.n2, p.d2)]),
        requirement: "计算，结果约到最简（假分数或带分数均可）",
        correct: ansExpr(N, D),
        traps: traps
    )
}

/** 分数减法：保证结果为正；干扰项 = 分别相减/分子忘乘倍数/把减法算成加法/借位错 + 形态陷阱 */
func genFracSub(_ rng: Mulberry32) -> Question {
    let r = rng.next()
    if r < 0.1 {
        // 三项同分母连减：保证 n1 > n2 + n3
        let d = pick(rng, [4, 5, 6, 8])
        let cs = coprimeNumerators(d) // 升序
        let lo = cs[0]
        let n1 = pick(rng, cs.filter { $0 > 2 * lo })
        let n2 = pick(rng, cs.filter { $0 < n1 - lo })
        let n3 = pick(rng, cs.filter { $0 < n1 - n2 })
        let N = n1 - n2 - n3
        var traps: [Trap] = []
        pushTrap(&traps, frac(n1 - n2 + n3, d), "符号看错了：两个减号都要减", Double(N) / Double(d))
        pushTrap(&traps, frac(n1 + n2 + n3, d), "把减法算成加法了", Double(N) / Double(d))
        pushTrap(&traps, frac(N + 1, d), "分子减错了，再算一遍", Double(N) / Double(d))
        pushTrap(&traps, frac(n1, d), "后两个数都没减", Double(N) / Double(d))
        formTraps(&traps, N, d)
        fillTraps(&traps, N, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "-", terms: [frac(n1, d), frac(n2, d), frac(n3, d)]),
            requirement: "计算，结果用最简分数表示",
            correct: ansExpr(N, d),
            traps: traps
        )
    }
    if r < 0.35 {
        // 整数 − 分数（练借位）
        let w = 2 + Int(rng.next() * 4)
        let d = pick(rng, ARITH_DENOMS)
        let n = randomNumerator(rng, d)
        let N = w * d - n
        var traps: [Trap] = []
        pushTrap(&traps, mixed(w - 1, n, d), "整数要借 1 变成同分母分数再减", Double(N) / Double(d))
        pushTrap(&traps, ansExpr(w * d + n, d), "把减法算成加法了", Double(N) / Double(d))
        pushTrap(&traps, mixed(w, n, d), "整数部分也要减，不是照抄", Double(N) / Double(d))
        pushTrap(&traps, frac(N + 1, d), "分子算错了，再算一遍", Double(N) / Double(d))
        formTraps(&traps, N, d)
        fillTraps(&traps, N, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "-", terms: [text(w), frac(n, d)]),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, d),
            traps: traps
        )
    }
    // 两项分数相减：重roll 保证被减数严格更大
    var pair = pickAddSubPair(rng)
    var tries = 0
    while tries < 60 && Double(pair.n1) / Double(pair.d1) == Double(pair.n2) / Double(pair.d2) {
        pair = pickAddSubPair(rng)
        tries += 1
    }
    var (d1, d2, n1, n2) = (pair.d1, pair.d2, pair.n1, pair.n2)
    if Double(n1) / Double(d1) < Double(n2) / Double(d2) {
        swap(&d1, &d2)
        swap(&n1, &n2)
    }
    let D = lcm(d1, d2)
    let N = n1 * (D / d1) - n2 * (D / d2)
    var traps: [Trap] = []
    if d1 == d2 {
        pushTrap(&traps, frac(N + 1, d1), "分子减错了，再算一遍", Double(N) / Double(D))
        pushTrap(&traps, frac(n1 + n2, d1), "把减法算成加法了", Double(N) / Double(D))
        pushTrap(&traps, frac(n2, d1), "只抄了减数，被减数没用上", Double(N) / Double(D))
        pushTrap(&traps, frac(n1, d1), "只抄了被减数，忘记减", Double(N) / Double(D))
        pushTrap(&traps, frac(N, d1 * 2), "同分母相减，分母不变，不要翻倍", Double(N) / Double(D))
    } else {
        if abs(n1 - n2) > 0 {
            pushTrap(&traps, frac(abs(n1 - n2), abs(d1 - d2)), "异分母相减要先通分，不能把分子分母分别相减", Double(N) / Double(D))
        }
        if n1 > n2 {
            pushTrap(&traps, frac(n1 - n2, D), "通分后分子也要乘同样的倍数", Double(N) / Double(D))
        }
        pushTrap(&traps, frac(n1 * (D / d1), D), "第二个数忘通分了，两个分子都要乘倍数", Double(N) / Double(D))
        pushTrap(&traps, frac(n2 * (D / d2), D), "只算了第二个数，不是减", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(n1 * (D / d1) + n2 * (D / d2), D), "把减法算成加法了", Double(N) / Double(D))
    }
    formTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "-", terms: [frac(n1, d1), frac(n2, d2)]),
        requirement: "计算，结果用最简分数表示",
        correct: ansExpr(N, D),
        traps: traps
    )
}

/** 乘法三形态：真×真 / 整数×分数 / 带分数×分数 均匀 */
private func pickMulForm(_ rng: Mulberry32) -> Int {
    let r = rng.next()
    return r < 1.0 / 3 ? 0 : r < 2.0 / 3 ? 1 : 2
}

/** 分数乘法：干扰项 = 误用倒数/只乘分子/整数加分子/带分数整数忘乘/把乘法算成加法 + 形态陷阱 */
func genFracMul(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.1 {
        // 三项连乘（真分数）
        let f = (0..<3).map { _ -> (n: Int, d: Int) in
            let d = pick(rng, ARITH_DENOMS)
            return (randomNumerator(rng, d), d)
        }
        let N = f[0].n * f[1].n * f[2].n
        let D = f[0].d * f[1].d * f[2].d
        let L = lcm(lcm(f[0].d, f[1].d), f[2].d)
        let sum = f.reduce(0) { $0 + $1.n * (L / $1.d) }
        var traps: [Trap] = []
        pushTrap(&traps, frac(N, f[0].d * f[1].d), "连乘要把所有分母都乘起来", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(sum, L), "把连乘算成连加了", Double(N) / Double(D))
        pushTrap(&traps, frac(N, D + 1), "分母乘错了，再算一遍", Double(N) / Double(D))
        pushTrap(&traps, frac(N + 1, D), "分子乘错了，再算一遍", Double(N) / Double(D))
        formTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "×", terms: f.map { frac($0.n, $0.d) }),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, D),
            traps: traps
        )
    }
    let form = pickMulForm(rng)
    if form == 0 {
        let d1 = pick(rng, ARITH_DENOMS)
        let d2 = pick(rng, ARITH_DENOMS)
        let n1 = randomNumerator(rng, d1)
        let n2 = randomNumerator(rng, d2)
        let N = n1 * n2
        let D = d1 * d2
        var traps: [Trap] = []
        pushTrap(&traps, ansExpr(n1 * d2, d1 * n2), "乘法不需要倒数，那是除法的做法", Double(N) / Double(D))
        pushTrap(&traps, frac(N, d1), "分母也要相乘", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(n1 * d2 + n2 * d1, d1 * d2), "把乘法算成加法了", Double(N) / Double(D))
        formTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "×", terms: [frac(n1, d1), frac(n2, d2)]),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, D),
            traps: traps
        )
    }
    if form == 1 {
        let k = 2 + Int(rng.next() * 8)
        let d = pick(rng, ARITH_DENOMS)
        let n = randomNumerator(rng, d)
        let N = k * n
        var traps: [Trap] = []
        pushTrap(&traps, frac(n, d * k), "整数要乘分子，不是乘分母", Double(N) / Double(d))
        pushTrap(&traps, frac(k + n, d), "整数要乘分子，不是加分子", Double(N) / Double(d))
        pushTrap(&traps, frac(n, d), "忘记乘整数了", Double(N) / Double(d))
        formTraps(&traps, N, d)
        fillTraps(&traps, N, d)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "×", terms: [text(k), frac(n, d)]),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, d),
            traps: traps
        )
    }
    // 带分数 × 分数
    let w = 1 + Int(rng.next() * 5)
    let d1 = pick(rng, ARITH_DENOMS)
    let n1 = randomNumerator(rng, d1)
    let d2 = pick(rng, ARITH_DENOMS)
    let n2 = randomNumerator(rng, d2)
    let a = w * d1 + n1
    let N = a * n2
    let D = d1 * d2
    var traps: [Trap] = []
    let rc = reduce2(n1 * n2, d1 * d2)
    pushTrap(&traps, mixed(w, rc.0, rc.1), "整数部分也要乘：先把带分数化成假分数再乘", Double(N) / Double(D))
    pushTrap(&traps, frac(N, d1), "分母也要相乘", Double(N) / Double(D))
    pushTrap(&traps, ansExpr(a * d2, d1 * n2), "乘法不需要倒数，那是除法的做法", Double(N) / Double(D))
    formTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "×", terms: [mixed(w, n1, d1), frac(n2, d2)]),
        requirement: "计算，结果约到最简（假分数或带分数均可）",
        correct: ansExpr(N, D),
        traps: traps
    )
}

/** 分数除法：内嵌 C4 倒数；干扰项 = 忘倒直接乘/倒错对象/漏整数部分 + 形态陷阱 */
func genFracDiv(_ rng: Mulberry32) -> Question {
    if rng.next() < 0.1 {
        // 三项连除（真分数，左结合 a÷b÷c）
        let f = (0..<3).map { _ -> (n: Int, d: Int) in
            let d = pick(rng, ARITH_DENOMS)
            return (randomNumerator(rng, d), d)
        }
        let N = f[0].n * f[1].d * f[2].d
        let D = f[0].d * f[1].n * f[2].n
        var traps: [Trap] = []
        pushTrap(&traps, ansExpr(f[0].n * f[1].d * f[2].n, f[0].d * f[1].n * f[2].d), "连除要把每个除数都倒过来乘", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(f[0].n * f[1].n * f[2].n, f[0].d * f[1].d * f[2].d), "除以一个数 = 乘它的倒数", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(f[0].n * f[1].n * f[2].d, f[0].d * f[1].d * f[2].n), "倒错对象了，看清哪个是除数", Double(N) / Double(D))
        pushTrap(&traps, frac(N, D + 1), "分母算错了，再算一遍", Double(N) / Double(D))
        formTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "÷", terms: f.map { frac($0.n, $0.d) }),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, D),
            traps: traps
        )
    }
    let r = rng.next()
    if r < 0.5 {
        // 真 ÷ 真
        let d1 = pick(rng, ARITH_DENOMS)
        let d2 = pick(rng, ARITH_DENOMS)
        let n1 = randomNumerator(rng, d1)
        let n2 = randomNumerator(rng, d2)
        let N = n1 * d2
        let D = d1 * n2
        var traps: [Trap] = []
        pushTrap(&traps, ansExpr(n1 * n2, d1 * d2), "除以分数 = 乘它的倒数，先把除数倒过来", Double(N) / Double(D))
        pushTrap(&traps, ansExpr(d1 * n2, n1 * d2), "倒错对象：要倒的是除数（÷ 后面的数）", Double(N) / Double(D))
        pushTrap(&traps, frac(n1 * d2 + 1, d1 * n2), "分子算错了，再算一遍", Double(N) / Double(D))
        pushTrap(&traps, frac(n1 * d2, d1 * n2 + 1), "分母算错了，再算一遍", Double(N) / Double(D))
        formTraps(&traps, N, D)
        fillTraps(&traps, N, D)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "÷", terms: [frac(n1, d1), frac(n2, d2)]),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, D),
            traps: traps
        )
    }
    if r < 0.75 {
        // 整数 ÷ 分数
        let k = 2 + Int(rng.next() * 8)
        let d = pick(rng, ARITH_DENOMS)
        let n = randomNumerator(rng, d)
        let N = k * d
        var traps: [Trap] = []
        pushTrap(&traps, ansExpr(k * n, d), "除以分数要乘它的倒数", Double(N) / Double(n))
        pushTrap(&traps, frac(n, k * d), "商写倒了：整数 ÷ 分数，结果应该更大", Double(N) / Double(n))
        pushTrap(&traps, frac(k, d * n), "要乘的是整个倒数", Double(N) / Double(n))
        pushTrap(&traps, frac(k, d), "只除了分母，分子没处理", Double(N) / Double(n))
        pushTrap(&traps, text(k), "忘记除了，整数没有变化", Double(N) / Double(n))
        formTraps(&traps, N, n)
        fillTraps(&traps, N, n)
        return makeQuestion(
            rng: rng,
            prompt: .op(op: "÷", terms: [text(k), frac(n, d)]),
            requirement: "计算，结果约到最简（假分数或带分数均可）",
            correct: ansExpr(N, n),
            traps: traps
        )
    }
    // 带分数 ÷ 分数
    let w = 1 + Int(rng.next() * 5)
    let d1 = pick(rng, ARITH_DENOMS)
    let n1 = randomNumerator(rng, d1)
    let d2 = pick(rng, ARITH_DENOMS)
    let n2 = randomNumerator(rng, d2)
    let a = w * d1 + n1
    let N = a * d2
    let D = d1 * n2
    var traps: [Trap] = []
    pushTrap(&traps, ansExpr(a * n2, d1 * d2), "除以分数 = 乘它的倒数，先把除数倒过来", Double(N) / Double(D))
    pushTrap(&traps, ansExpr(n1 * d2, d1 * n2), "漏掉整数部分：先把带分数化成假分数再除", Double(N) / Double(D))
    pushTrap(&traps, ansExpr(w * d2, n2), "带分数要整体化假分数，不能只算整数部分", Double(N) / Double(D))
    formTraps(&traps, N, D)
    fillTraps(&traps, N, D)
    return makeQuestion(
        rng: rng,
        prompt: .op(op: "÷", terms: [mixed(w, n1, d1), frac(n2, d2)]),
        requirement: "计算，结果约到最简（假分数或带分数均可）",
        correct: ansExpr(N, D),
        traps: traps
    )
}

let fracAddSkill = Skill(
    id: "g6-frac-add",
    title: "分数加法",
    intro: [
        "考核点：分数加法速算（两项 90% + 三项连加 10%）",
        "同分母 50%：分母不变分子相加；异分母 50%：先通分再加（70% 分母成倍数关系）",
        "结果约到最简即可，假分数、带分数都算对（例如 1/2 + 3/4 = 5/4 或 1¼）",
        "小心陷阱：分母也加、通分忘乘分子、把加法算成乘法",
    ],
    timeLimitSec: 15,
    questionCount: 10,
    acceptImproper: true,
    generators: [genFracAdd]
)

let fracSubSkill = Skill(
    id: "g6-frac-sub",
    title: "分数减法",
    intro: [
        "考核点：分数减法速算（两项 90% + 三项连减 10%，结果保证为正）",
        "同分母 50%、异分母 50%，另有 25% 是整数减分数（练借位）",
        "结果约到最简即可，假分数、带分数都算对（例如 2 - 3/4 = 5/4 或 1¼）",
        "小心陷阱：分子分母分别相减、把减法算成加法、整数忘借位",
    ],
    timeLimitSec: 15,
    questionCount: 10,
    acceptImproper: true,
    generators: [genFracSub]
)

let fracMulSkill = Skill(
    id: "g6-frac-mul",
    title: "分数乘法",
    intro: [
        "考核点：分数乘法速算（两项 90% + 三项连乘 10%）",
        "三种形态均匀：真分数×真分数 / 整数×分数 / 带分数×分数",
        "结果约到最简即可，假分数、带分数都算对；能约分先约分更快（例如 3/4 × 2/3 = 1/2）",
        "小心陷阱：误用倒数（那是除法！）、只乘分子、带分数整数忘乘",
    ],
    timeLimitSec: 15,
    questionCount: 10,
    acceptImproper: true,
    generators: [genFracMul]
)

let fracDivSkill = Skill(
    id: "g6-frac-div",
    title: "分数除法",
    intro: [
        "考核点：分数除法速算（两项 90% + 三项连除 10%）",
        "口诀：除以一个数 = 乘它的倒数（倒的是 ÷ 后面的数！）",
        "结果约到最简即可，假分数、带分数都算对（例如 1½ ÷ 3/4 = 2）",
        "小心陷阱：忘倒直接乘、倒错对象、漏掉带分数的整数部分",
    ],
    timeLimitSec: 18,
    questionCount: 10,
    acceptImproper: true,
    generators: [genFracDiv]
)
