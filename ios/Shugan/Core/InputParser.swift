import Foundation

/**
 * 复习模式填空输入解析 —— 与网页版 QuizRunner.tsx 的 parseAnswerInput / formError 一致。
 * 支持 整数 / 小数 / 分数(3/4) / 带分数(1 3/4，空格分隔)，可带负号。
 */

enum InputForm {
    case int, dec, frac, mixed
}

struct ParsedInput {
    let value: Double
    let form: InputForm
    let reducible: Bool // 分数部分未约到最简
}

private func gcdNum(_ a: Int, _ b: Int) -> Int { b != 0 ? gcdNum(b, a % b) : a }

private func matches(_ s: String, _ pattern: String) -> Bool {
    s.range(of: pattern, options: .regularExpression) != nil
}

private func groups(_ s: String, _ pattern: String) -> [String]? {
    guard let re = try? NSRegularExpression(pattern: pattern),
          let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
    var out: [String] = []
    for i in 1..<re.numberOfCaptureGroups {
        if let r = Range(m.range(at: i), in: s) { out.append(String(s[r])) } else { return nil }
    }
    return out
}

func parseAnswerInput(_ s: String) -> ParsedInput? {
    let t = s.trimmingCharacters(in: .whitespaces)
    let neg = t.hasPrefix("-")
    let body = neg ? String(t.dropFirst()) : t
    let sign = neg ? -1.0 : 1.0
    if matches(body, #"^\d+$"#) {
        return ParsedInput(value: sign * (Double(body) ?? 0), form: .int, reducible: false)
    }
    if matches(body, #"^\d+\.\d+$"#) {
        return ParsedInput(value: sign * (Double(body) ?? 0), form: .dec, reducible: false)
    }
    if let m = groups(body, #"^(\d+)/(\d+)$"#), Int(m[1]) != 0 {
        let n = Int(m[0]) ?? 0
        let d = Int(m[1]) ?? 1
        return ParsedInput(value: sign * Double(n) / Double(d), form: .frac, reducible: gcdNum(n, d) != 1)
    }
    if let m = groups(body, #"^(\d+) (\d+)/(\d+)$"#), Int(m[2]) != 0 {
        let n = Int(m[1]) ?? 0
        let d = Int(m[2]) ?? 1
        return ParsedInput(value: sign * ((Double(m[0]) ?? 0) + Double(n) / Double(d)), form: .mixed, reducible: gcdNum(n, d) != 1)
    }
    return nil
}

/**
 * 形式校验：数值相等后，还要满足题目要求的形式（最简分数/带分数/小数）。
 * acceptImproper 时：带分数答案也接受最简假分数；allowUnreduced 时：跳过约分检查。
 */
func formError(_ parsed: ParsedInput, correct: MathExpr, acceptImproper: Bool = false, allowUnreduced: Bool = false) -> String? {
    if case .frac = correct {
        if parsed.form != .frac { return "数值对了，但要写成分数形式" }
        if parsed.reducible && !allowUnreduced { return "数值对了，但还没约到最简" }
    }
    if case .mixed = correct {
        if acceptImproper && parsed.form == .frac {
            if parsed.reducible { return "数值对了，但还没约到最简" }
            return nil
        }
        if parsed.form != .mixed { return "数值对了，但要写成带分数形式" }
        if parsed.reducible { return "数值对了，但分数部分还没约到最简" }
    }
    return nil
}
