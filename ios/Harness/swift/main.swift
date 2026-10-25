import Foundation

/**
 * Swift 端题目导出：与 TS 端 dump.ts 输出格式完全一致。
 * [skillId, seed, qIndex, promptKey, requirement, [[choiceKey, correct, trap], ...]]
 * 复习模式专属生成器以 id+"@review" 的虚拟技能参与导出（与 TS 端一致）。
 */

func choiceJSON(_ c: Choice) -> String {
    let trapJSON = c.trap.map { jsQuote($0) } ?? "null"
    return "[\(jsQuote(exprKey(c.value))),\(c.correct ? "true" : "false"),\(trapJSON)]"
}

func dumpQuiz(_ label: String, _ s: Skill, into lines: inout [String]) {
    for seed in 0..<500 {
        let quiz = generateQuiz(s, seed: seed)
        for (i, q) in quiz.enumerated() {
            let choices = q.choices.map(choiceJSON).joined(separator: ",")
            lines.append("[\(jsQuote(label)),\(seed),\(i),\(jsQuote(exprKey(q.prompt))),\(jsQuote(q.requirement)),[\(choices)]]")
        }
    }
}

var lines: [String] = []
for g in GRADES {
    for u in g.units {
        for s in u.skills {
            dumpQuiz(s.id, s, into: &lines)
            if let rg = s.reviewGenerators {
                var r = s
                r.generators = rg
                dumpQuiz(s.id + "@review", r, into: &lines)
            }
        }
    }
}
print(lines.joined(separator: "\n"))
