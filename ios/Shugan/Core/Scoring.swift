import Foundation

/**
 * 计分规则 —— 与网页版 core/scoring.ts 一一对应。
 * 三模式：复习（填空）/ 闯关（选择）/ 进阶（错一题或超时即出局，全对 ×2）。
 * 答错扣分（而不是不得分）是防瞎猜的核心：乱猜的期望收益为负。
 */

enum ScoreRules {
    static let base = 10                 // 闯关/进阶：答对基础分
    static let reviewBase = 15           // 复习模式（填空）：答对基础分更高
    static let maxTimeBonus = 10         // 时间加成上限：剩余时间占比 × 该值
    static let streakBonus = 2           // 每个连对的加成
    static let streakBonusCap = 5
    static let wrongPickPenalty = -8     // 闯关模式每次错选即时扣分（不结算本题）
    static let reviewWrongPenalty = -5   // 复习模式每次填错即时扣分
    static let afterWrong1 = 2           // 错 1 次后答对
    static let reviewAfterWrong1 = 5     // 复习模式重填 1 次后答对
    static let afterWrong2 = 1           // 错 2 次后答对（保底，保护挫败感）
    static let reviewAfterWrong2 = 2     // 复习模式重填 2 次后答对
    static let advancedMultiplier = 2    // 进阶模式全对翻倍
}

struct ScoreInput {
    let mode: QuizMode
    let correct: Bool
    let timeLeftSec: Double   // 作答剩余秒数（超时为 0）
    let timeLimitSec: Double
    let streak: Int           // 作答前的连续正确数
    let timedOut: Bool        // 是否超时未答
    let wrongAttempts: Int    // 本题此前答错的次数
}

struct ScoreResult {
    let delta: Int
    let newStreak: Int
    let breakdown: [String]
}

func scoreAnswer(_ input: ScoreInput) -> ScoreResult {
    let review = input.mode == .review
    if !input.correct {
        if input.timedOut {
            return ScoreResult(delta: 0, newStreak: 0, breakdown: ["超时未答 +0", "连对中断"])
        }
        let penalty = review ? ScoreRules.reviewWrongPenalty : ScoreRules.wrongPickPenalty
        return ScoreResult(delta: penalty, newStreak: 0, breakdown: ["答错 \(penalty)", "连对中断"])
    }
    // 答错后纠正答对：低分鼓励，连对重新计算，无时间加成
    if input.wrongAttempts == 1 {
        let v = review ? ScoreRules.reviewAfterWrong1 : ScoreRules.afterWrong1
        return ScoreResult(delta: v, newStreak: 1, breakdown: ["纠正后答对 +\(v)", "连对重新计算"])
    }
    if input.wrongAttempts >= 2 {
        let v = review ? ScoreRules.reviewAfterWrong2 : ScoreRules.afterWrong2
        return ScoreResult(delta: v, newStreak: 1, breakdown: ["纠正后答对 +\(v)", "连对重新计算"])
    }
    // 首次作答即对：基础 + 速度 + 连对
    let base = review ? ScoreRules.reviewBase : ScoreRules.base
    let timeBonus = jsRound((input.timeLeftSec / input.timeLimitSec) * Double(ScoreRules.maxTimeBonus))
    let streakBonus = min(input.streak, ScoreRules.streakBonusCap) * ScoreRules.streakBonus
    let delta = base + timeBonus + streakBonus
    var parts = ["答对 +\(base)", "速度 +\(timeBonus)"]
    if streakBonus > 0 { parts.append("连对×\(input.streak) +\(streakBonus)") }
    return ScoreResult(delta: delta, newStreak: input.streak + 1, breakdown: parts)
}
