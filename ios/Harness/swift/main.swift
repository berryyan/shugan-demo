import Foundation

/**
 * Swift 端题目导出：与 TS 端 dump.ts 输出格式完全一致。
 * [skillId, seed, qIndex, promptKey, requirement, [[choiceKey, correct, trap], ...]]
 */

func choiceJSON(_ c: Choice) -> String {
    let trapJSON = c.trap.map { jsQuote($0) } ?? "null"
    return "[\(jsQuote(exprKey(c.value))),\(c.correct ? "true" : "false"),\(trapJSON)]"
}

var lines: [String] = []
for g in GRADES {
    for u in g.units {
        for s in u.skills {
            for seed in 0..<500 {
                let quiz = generateQuiz(s, seed: seed)
                for (i, q) in quiz.enumerated() {
                    let choices = q.choices.map(choiceJSON).joined(separator: ",")
                    lines.append("[\(jsQuote(s.id)),\(seed),\(i),\(jsQuote(exprKey(q.prompt))),\(jsQuote(q.requirement)),[\(choices)]]")
                }
            }
        }
    }
}
print(lines.joined(separator: "\n"))
