import Foundation

var fail = 0
func check(_ cond: Bool, _ msg: String) {
    if !cond { fail += 1; print("FAIL: \(msg)") }
}

// 解析形态
let cases: [(String, Double, String)] = [
    ("6", 6, "int"), ("-12", -12, "int"), ("3.5", 3.5, "dec"), ("-0.25", -0.25, "dec"),
    ("6/7", 6.0/7.0, "frac"), ("-3/4", -0.75, "frac"), ("4/6", 4.0/6.0, "frac"),
    ("1 1/2", 1.5, "mixed"), ("-3 5/6", -(3.0+5.0/6.0), "mixed"),
]
for (s, v, f) in cases {
    guard let p = parseAnswerInput(s) else { fail += 1; print("FAIL: '\(s)' 解析为 nil"); continue }
    check(abs(p.value - v) < 1e-9, "'\(s)' 值错误: \(p.value) != \(v)")
    check("\(p.form)" == f, "'\(s)' 形态错误: \(p.form) != \(f)")
}
// 非法输入必须返回 nil 而不是崩溃
for s in ["", "abc", "1/0", "1 2/0", "1.2.3", "/", "  ", "1 /2", "1/ 2"] {
    check(parseAnswerInput(s) == nil, "'\(s)' 应为 nil")
}
// reducible 标记
check(parseAnswerInput("4/6")!.reducible == true, "4/6 应标记可约分")
check(parseAnswerInput("3/4")!.reducible == false, "3/4 应不可约分")
check(parseAnswerInput("1 2/4")!.reducible == true, "1 2/4 应标记可约分")

// formError
let frac = MathExpr.frac(n: "3", d: "4")
let mixed = MathExpr.mixed(whole: "1", n: "1", d: "2")
check(formError(parseAnswerInput("0.75")!, correct: frac) == "数值对了，但要写成分数形式", "小数答分数题应提示形式")
check(formError(parseAnswerInput("6/8")!, correct: frac) == "数值对了，但还没约到最简", "未约分应提示")
check(formError(parseAnswerInput("3/4")!, correct: frac) == nil, "最简分数应通过")
check(formError(parseAnswerInput("3/2")!, correct: mixed) == "数值对了，但要写成带分数形式", "假分数答带分数题应提示")
check(formError(parseAnswerInput("3/2")!, correct: mixed, acceptImproper: true) == nil, "acceptImproper 应放行假分数")
check(formError(parseAnswerInput("4/2")!, correct: mixed, acceptImproper: true) == "数值对了，但还没约到最简", "acceptImproper 下仍查约分")
check(formError(parseAnswerInput("1 1/2")!, correct: mixed) == nil, "带分数应通过")
check(formError(parseAnswerInput("6/8")!, correct: frac, allowUnreduced: true) == nil, "allowUnreduced 应跳过约分")

print(fail == 0 ? "ALL_PASS \(cases.count + 17) 项" : "\(fail) 项失败")
