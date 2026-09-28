/**
 * 计分规则 —— 三模式：
 * - 复习模式（填空）：20 题、限时最长；单题分值最高（无选项提示最难），填错提示原因可重填
 * - 闯关模式（选择）：10 题、限时适中；固定 4 选项直显，错选扣分置灰可重选
 * - 进阶模式（考场）：10 题、限时最短；错一题或超时即出局得 0；全对总分 ×2
 * 答错扣分（而不是不得分）是防瞎猜的核心：乱猜的期望收益为负。
 */
import type { QuizMode } from './types';

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
  /** 闯关/进阶：答对基础分 */
  base: 10,
  /** 复习模式（填空）：答对基础分更高 */
  reviewBase: 15,
  /** 时间加成上限：剩余时间占比 × 该值 */
  maxTimeBonus: 10,
  /** 每个连对的加成 */
  streakBonus: 2,
  streakBonusCap: 5,
  /** 闯关模式每次错选即时扣分（不结算本题） */
  wrongPickPenalty: -8,
  /** 复习模式每次填错即时扣分（不结算本题） */
  reviewWrongPenalty: -5,
  /** 错 1 次后答对 */
  afterWrong1: 2,
  /** 复习模式重填 1 次后答对（填空纠错成本低于乱点） */
  reviewAfterWrong1: 5,
  /** 错 2 次后答对（保底，保护挫败感） */
  afterWrong2: 1,
  /** 复习模式重填 2 次后答对 */
  reviewAfterWrong2: 2,
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
  // 首次作答即对：基础 + 速度 + 连对
  const base = review ? r.reviewBase : r.base;
  const timeBonus = Math.round((input.timeLeftSec / input.timeLimitSec) * r.maxTimeBonus);
  const streakBonus = Math.min(input.streak, r.streakBonusCap) * r.streakBonus;
  const delta = base + timeBonus + streakBonus;
  const parts = [`答对 +${base}`, `速度 +${timeBonus}`];
  if (streakBonus > 0) parts.push(`连对×${input.streak} +${streakBonus}`);
  return { delta, newStreak: input.streak + 1, breakdown: parts };
}
