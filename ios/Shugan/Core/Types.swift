import Foundation

/**
 * 核心领域类型 —— 与网页版 core/types.ts 一一对应。
 * 整个系统围绕「年级 → 单元 → 知识点(Skill) → 题目生成器」组织。
 */

/** 结构化数学表达式：题面与选项用真正的分数排版渲染，不用斜杠文本 */
indirect enum MathExpr: Equatable {
    case text(String)                       // 小数、整数等普通文本
    case frac(n: String, d: String)         // 真/假分数：分子在上、分母在下
    case mixed(whole: String, n: String, d: String) // 带分数：整数 + 分数
    case vs(left: MathExpr, right: MathExpr)        // 大小比较：left ○ right
    case op(op: String, terms: [MathExpr])  // 运算式：+ - × ÷ 和（'和'仅用于成对展示）
}

/** JS JSON.stringify 的字符串转义（仅处理实际会出现的字符） */
func jsQuote(_ s: String) -> String {
    var out = "\""
    for c in s {
        switch c {
        case "\"": out += "\\\""
        case "\\": out += "\\\\"
        case "\n": out += "\\n"
        case "\r": out += "\\r"
        case "\t": out += "\\t"
        default:
            if c.unicodeScalars.count == 1, let v = c.unicodeScalars.first?.value, v < 0x20 {
                out += String(format: "\\u%04x", v)
            } else {
                out.append(c)
            }
        }
    }
    return out + "\""
}

/** 表达式的 JSON 形态（与 TS JSON.stringify 键序一致），嵌套表达式也走这里 */
private func exprJSON(_ e: MathExpr) -> String {
    switch e {
    case .text(let t):
        return "{\"kind\":\"text\",\"text\":\(jsQuote(t))}"
    case .frac(let n, let d):
        return "{\"kind\":\"frac\",\"n\":\(jsQuote(n)),\"d\":\(jsQuote(d))}"
    case .mixed(let w, let n, let d):
        return "{\"kind\":\"mixed\",\"whole\":\(jsQuote(w)),\"n\":\(jsQuote(n)),\"d\":\(jsQuote(d))}"
    case .vs(let l, let r):
        return "{\"kind\":\"vs\",\"left\":\(exprJSON(l)),\"right\":\(exprJSON(r))}"
    case .op(let op, let terms):
        return "{\"kind\":\"op\",\"op\":\(jsQuote(op)),\"terms\":[\(terms.map(exprJSON).joined(separator: ","))]}"
    }
}

/** 与 TS exprKey 一致：text 用原文本，其余用 JSON 串 */
func exprKey(_ e: MathExpr) -> String {
    if case .text(let t) = e { return t }
    return exprJSON(e)
}

/** JS parseFloat 语义：解析失败为 NaN */
private func jsNum(_ s: String) -> Double { Double(s) ?? .nan }

/** 表达式的数值（比较、校验用），与 TS exprValue 一致 */
func exprValue(_ e: MathExpr) -> Double {
    switch e {
    case .text(let t):
        return jsNum(t)
    case .frac(let n, let d):
        return jsNum(n) / jsNum(d)
    case .mixed(let w, let n, let d):
        // 负数带分数语义：-3 5/6 = -(3 + 5/6)；JS Math.sign(w || 1)：0/NaN 时取 1
        let wv = jsNum(w)
        let s: Double = wv < 0 ? -1 : 1
        return s * (abs(wv) + jsNum(n) / jsNum(d))
    case .op(let op, let terms):
        let vals = terms.map(exprValue)
        switch op {
        case "+": return vals.reduce(0, +)
        case "-": return vals.dropFirst().reduce(vals.first ?? .nan, -)
        case "×": return vals.reduce(1, *)
        case "÷": return vals.dropFirst().reduce(vals.first ?? .nan, /)
        default: return .nan // '和' 成对展示，无数值语义
        }
    case .vs:
        return .nan
    }
}

/** 单个选项。trap 标识干扰项对应的典型误区，答错时针对性讲解 */
struct Choice: Equatable {
    let id: String
    let value: MathExpr
    let correct: Bool
    let trap: String?
}

struct Question {
    let id: String
    let prompt: MathExpr        // 大字展示的题面
    let requirement: String     // 答题要求，例如 "用最简分数表示"
    let choices: [Choice]
}

/** 题目生成器：传入随机源，产出一道题（含正确答案 + 误区干扰项） */
typealias QuestionGenerator = (Mulberry32) -> Question

/** 一个可考核的知识点（一次快问快答的单位） */
struct Skill {
    let id: String
    let title: String
    let intro: [String]         // 引导文案：考核什么、怎么考
    let timeLimitSec: Int       // 每题基准限时（秒）：闯关直接用，复习 ×1.5，进阶 ×0.6
    let questionCount: Int      // 一局题数（闯关/进阶）；复习模式固定 20 题
    var supportsReview = true   // false 时不出现在复习模式
    var allowNegative = false   // true 时复习模式键盘增加负号键
    var acceptImproper = false  // true 时复习模式答案 >1 同时接受假分数和带分数
    var allowUnreduced = false  // true 时复习模式接受未约分的正确答案
    var numericKeypad = false   // true 时复习模式键盘裁掉分数线/带分数键
    var hideMixedKey = false    // true 时复习模式键盘裁掉带分数空格键
    let generators: [QuestionGenerator]
}

/** 快问快答三模式 */
enum QuizMode: String {
    case review, normal, advanced

    var displayName: String {
        switch self {
        case .review: return "复习"
        case .normal: return "闯关"
        case .advanced: return "进阶"
        }
    }
}

/** JS Math.round：四舍五入（.5 向 +∞） */
func jsRound(_ x: Double) -> Int { Int(floor(x + 0.5)) }

/** 各模式的题量与限时换算 */
func modeParams(_ skill: Skill, _ mode: QuizMode) -> (count: Int, timeLimitSec: Int) {
    switch mode {
    case .review:
        return (20, jsRound(Double(skill.timeLimitSec) * 1.5))
    case .advanced:
        return (skill.questionCount, max(4, jsRound(Double(skill.timeLimitSec) * 0.6)))
    case .normal:
        return (skill.questionCount, skill.timeLimitSec)
    }
}

struct Unit {
    let id: String
    let title: String
    let skills: [Skill]
}

struct Grade {
    let id: String
    let title: String
    let units: [Unit]
    let available: Bool // false 表示占位（即将上线）
}
