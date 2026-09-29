/**
 * 计分规则 v2「最小整数版」—— 与 iOS 版 Scoring.swift 一一对应，两边必须同步修改。
 * 三模式：
 * - 复习模式（填空）：20 题、限时最长；单题分值最高（无选项提示最难），填错提示原因可重填
 * - 闯关模式（选择）：10 题、限时适中；固定 4 选项直显，错选扣分置灰可重选
 * - 进阶模式（考场）：10 题、限时最短；错一题或超时即出局得 0；全对总分 ×2
 * 答错扣分（而不是不得分）是防瞎猜的核心：乱猜的期望收益为负。
 * v2（2026-09-30）：全是个位数，无小数；错 2 次后答对保底 0（不扣分）。
 * 完整规则文档见 docs/积分规则-v2.md
 */
import type { QuizMode } from './types.ts';

export interface ScoreInput {
  mode: QuizMode;
  correct: boolean;
  /** 作答剩余秒数（超时为 0） */
  timeLeftSec: number;
  timeLimitSec: number;
  /** 作答前的连续正确数 */
  streak: number;
  /** 是否超时未答 */
  timedOut: boolean;
  /** 本题此前答错的次数（闯关错选 / 复习重填） */
  wrongAttempts: number;
}

export interface ScoreResult {
  delta: number;
  newStreak: number;
  breakdown: string[];
}

export const SCORE_RULES = {
  /** 闯关/进阶：首次答对基础分 */
  base: 2,
  /** 复习模式（填空）：首次答对基础分更高 */
  reviewBase: 3,
  /** 速度加成：剩余时间 ≥ 50% 时 +1，否则 +0 */
  speedBonus: 1,
  /** 连对里程碑：每满 5 连对，当题额外 +1 */
  streakMilestone: 5,
  /** 闯关模式每次错选即时扣分（不结算本题） */
  wrongPickPenalty: -2,
  /** 复习模式每次填错即时扣分（不结算本题） */
  reviewWrongPenalty: -2,
  /** 错 1 次后答对 */
  afterWrong1: 1,
  /** 复习模式重填 1 次后答对 */
  reviewAfterWrong1: 1,
  /** 错 2 次后答对（保底 0：不加分也不扣分） */
  afterWrong2: 0,
  /** 复习模式重填 2 次后答对 */
  reviewAfterWrong2: 0,
  /** 进阶模式全对翻倍 */
  advancedMultiplier: 2,
} as const;

export function scoreAnswer(input: ScoreInput): ScoreResult {
  const r = SCORE_RULES;
  const review = input.mode === 'review';
  if (!input.correct) {
    if (input.timedOut) {
      return { delta: 0, newStreak: 0, breakdown: ['超时未答 +0', '连对中断'] };
    }
    const penalty = review ? r.reviewWrongPenalty : r.wrongPickPenalty;
    return { delta: penalty, newStreak: 0, breakdown: [`答错 ${penalty}`, '连对中断'] };
  }
  // 答错后纠正答对：低分鼓励，连对重新计算，无时间加成
  if (input.wrongAttempts === 1) {
    const v = review ? r.reviewAfterWrong1 : r.afterWrong1;
    return { delta: v, newStreak: 1, breakdown: [`纠正后答对 +${v}`, '连对重新计算'] };
  }
  if (input.wrongAttempts >= 2) {
    const v = review ? r.reviewAfterWrong2 : r.afterWrong2;
    return { delta: v, newStreak: 1, breakdown: [`纠正后答对 +${v}`, '连对重新计算'] };
  }
  // 首次作答即对：基础 + 速度（剩余 ≥50% 时 +1）+ 连对里程碑（每满 5 连 +1）
  const base = review ? r.reviewBase : r.base;
  const speed = input.timeLeftSec * 2 >= input.timeLimitSec ? r.speedBonus : 0;
  const newStreak = input.streak + 1;
  const streak = newStreak % r.streakMilestone === 0 ? 1 : 0;
  const delta = base + speed + streak;
  const parts = [`答对 +${base}`];
  if (speed > 0) parts.push(`速度快 +${speed}`);
  if (streak > 0) parts.push(`${newStreak} 连对 +${streak}`);
  return { delta, newStreak, breakdown: parts };
}
