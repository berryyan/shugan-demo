var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/scoring.ts
var scoring_exports = {};
__export(scoring_exports, {
  SCORE_RULES: () => SCORE_RULES,
  scoreAnswer: () => scoreAnswer
});
module.exports = __toCommonJS(scoring_exports);
var SCORE_RULES = {
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
  advancedMultiplier: 2
};
function scoreAnswer(input) {
  const r = SCORE_RULES;
  const review = input.mode === "review";
  if (!input.correct) {
    if (input.timedOut) {
      return { delta: 0, newStreak: 0, breakdown: ["\u8D85\u65F6\u672A\u7B54 +0", "\u8FDE\u5BF9\u4E2D\u65AD"] };
    }
    const penalty = review ? r.reviewWrongPenalty : r.wrongPickPenalty;
    return { delta: penalty, newStreak: 0, breakdown: [`\u7B54\u9519 ${penalty}`, "\u8FDE\u5BF9\u4E2D\u65AD"] };
  }
  if (input.wrongAttempts === 1) {
    const v = review ? r.reviewAfterWrong1 : r.afterWrong1;
    return { delta: v, newStreak: 1, breakdown: [`\u7EA0\u6B63\u540E\u7B54\u5BF9 +${v}`, "\u8FDE\u5BF9\u91CD\u65B0\u8BA1\u7B97"] };
  }
  if (input.wrongAttempts >= 2) {
    const v = review ? r.reviewAfterWrong2 : r.afterWrong2;
    return { delta: v, newStreak: 1, breakdown: [`\u7EA0\u6B63\u540E\u7B54\u5BF9 +${v}`, "\u8FDE\u5BF9\u91CD\u65B0\u8BA1\u7B97"] };
  }
  const base = review ? r.reviewBase : r.base;
  const timeBonus = Math.round(input.timeLeftSec / input.timeLimitSec * r.maxTimeBonus);
  const streakBonus = Math.min(input.streak, r.streakBonusCap) * r.streakBonus;
  const delta = base + timeBonus + streakBonus;
  const parts = [`\u7B54\u5BF9 +${base}`, `\u901F\u5EA6 +${timeBonus}`];
  if (streakBonus > 0)
    parts.push(`\u8FDE\u5BF9\xD7${input.streak} +${streakBonus}`);
  return { delta, newStreak: input.streak + 1, breakdown: parts };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SCORE_RULES,
  scoreAnswer
});
