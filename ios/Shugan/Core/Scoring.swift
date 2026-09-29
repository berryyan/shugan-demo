import Foundation

/**
 * 计分规则 v2「最小整数版」—— 与网页版 core/scoring.ts 一一对应，两边必须同步修改。
 * 三模式：复习（填空）/ 闯关（选择）/ 进阶（错一题或超时即出局，全对 ×2）。
 * 答错扣分（而不是不得分）是防瞎猜的核心：乱猜的期望收益为负。
 * v2（2026-09-30）：全是个位数，无小数；错 2 次后答对保底 0（不扣分）。
 * 完整规则文档见 docs/积分规则-v2.md
 */

enum ScoreRules {
    static let base = 2                  // 闯关/进阶：首次答对基础分
    static let reviewBase = 3            // 复习模式（填空）：首次答对基础分更高
    static let speedBonus = 1            // 速度加成：剩余时间 ≥ 50% 时 +1，否则 +0
    static let streakMilestone = 5       // 连对里程碑：每满 5 连对，当题额外 +1
    static let wrongPickPenalty = -2     // 闯关模式每次错选即时扣分（不结算本题）
    static let reviewWrongPenalty = -2   // 复习模式每次填错即时扣分
    static let afterWrong1 = 1           // 错 1 次后答对
    static let reviewAfterWrong1 = 1     // 复习模式重填 1 次后答对
    static let afterWrong2 = 0           // 错 2 次后答对（保底 0：不加分也不扣分）
    static let reviewAfterWrong2 = 0     // 复习模式重填 2 次后答对
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
    // 首次作答即对：基础 + 速度（剩余 ≥50% 时 +1）+ 连对里程碑（每满 5 连 +1）
    let base = review ? ScoreRules.reviewBase : ScoreRules.base
    let speed = input.timeLeftSec * 2 >= input.timeLimitSec ? ScoreRules.speedBonus : 0
    let newStreak = input.streak + 1
    let streak = newStreak % ScoreRules.streakMilestone == 0 ? 1 : 0
    let delta = base + speed + streak
    var parts = ["答对 +\(base)"]
    if speed > 0 { parts.append("速度快 +\(speed)") }
    if streak > 0 { parts.append("\(newStreak) 连对 +\(streak)") }
    return ScoreResult(delta: delta, newStreak: newStreak, breakdown: parts)
}
