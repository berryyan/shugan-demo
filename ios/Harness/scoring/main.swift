import Foundation

let modes: [QuizMode] = [.review, .normal, .advanced]
let ratios: [Double] = [0, 0.25, 0.5, 0.75, 1]
var lines: [String] = []

func jsEscape(_ s: String) -> String {
    s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
}

for mode in modes {
    for streak in 0...11 {
        for r in ratios {
            for wa in 0...3 {
                let res = scoreAnswer(ScoreInput(
                    mode: mode, correct: true, timeLeftSec: r * 10, timeLimitSec: 10,
                    streak: streak, timedOut: false, wrongAttempts: wa))
                let b = res.breakdown.map { "\"\(jsEscape($0))\"" }.joined(separator: ",")
                let rs = r == r.rounded() ? String(Int(r)) : String(r)
                lines.append("{\"mode\":\"\(mode.rawValue)\",\"streak\":\(streak),\"r\":\(rs),\"wa\":\(wa),\"d\":\(res.delta),\"ns\":\(res.newStreak),\"b\":[\(b)]}")
            }
        }
    }
    for timedOut in [true, false] {
        let res = scoreAnswer(ScoreInput(
            mode: mode, correct: false, timeLeftSec: timedOut ? 0 : 3, timeLimitSec: 10,
            streak: 4, timedOut: timedOut, wrongAttempts: 0))
        let b = res.breakdown.map { "\"\(jsEscape($0))\"" }.joined(separator: ",")
        lines.append("{\"mode\":\"\(mode.rawValue)\",\"wrong\":true,\"timedOut\":\(timedOut),\"d\":\(res.delta),\"ns\":\(res.newStreak),\"b\":[\(b)]}")
    }
}
print(lines.joined(separator: "\n"))
