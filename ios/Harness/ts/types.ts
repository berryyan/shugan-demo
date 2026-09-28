/**
 * 核心领域类型 —— 整个系统围绕「年级 → 单元 → 知识点(Skill) → 题目生成器」组织。
 * 新增考核内容只需新增数据与生成器，无需改动引擎。
 */

/** 结构化数学表达式：题面与选项不用斜杠文本，而是用真正的分数排版渲染 */
export type MathExpr =
  | { kind: 'text'; text: string } // 小数、整数等普通文本
  | { kind: 'frac'; n: string; d: string } // 真/假分数：分子在上、分母在下
  | { kind: 'mixed'; whole: string; n: string; d: string } // 带分数：整数 + 分数
  | { kind: 'vs'; left: MathExpr; right: MathExpr } // 大小比较：left ○ right
  | { kind: 'op'; op: '+' | '-' | '×' | '÷' | '和'; terms: MathExpr[] }; // 运算式：多项连算（'和'仅用于成对展示）

export function exprKey(e: MathExpr): string {
  return e.kind === 'text' ? e.text : JSON.stringify(e);
}

/** 表达式的数值（比较、校验用） */
export function exprValue(e: MathExpr): number {
  switch (e.kind) {
    case 'text':
      return parseFloat(e.text);
    case 'frac':
      return Number(e.n) / Number(e.d);
    case 'mixed': {
      // 负数带分数语义：-3 5/6 = -(3 + 5/6)，与填空解析 parseAnswerInput 一致
      const w = Number(e.whole);
      return Math.sign(w || 1) * (Math.abs(w) + Number(e.n) / Number(e.d));
    }
    case 'op': {
      const vals = e.terms.map(exprValue);
      switch (e.op) {
        case '+':
          return vals.reduce((a, b) => a + b, 0);
        case '-':
          return vals.slice(1).reduce((a, b) => a - b, vals[0]);
        case '×':
          return vals.reduce((a, b) => a * b, 1);
        case '÷':
          return vals.slice(1).reduce((a, b) => a / b, vals[0]);
        case '和':
          return NaN; // 成对展示，无数值语义
      }
      return NaN;
    }
    case 'vs':
      return NaN;
  }
}

/** 单个选项。tag 用于标识干扰项对应的典型误区，答错时可针对性讲解 */
export interface Choice {
  id: string;
  value: MathExpr;
  correct: boolean;
  /** 干扰项误区标签，例如 "未约分" / "数位拼接" / "分子分母颠倒" */
  trap?: string;
}

export interface Question {
  id: string;
  /** 大字展示的题面 */
  prompt: MathExpr;
  /** 答题要求，例如 "用最简分数表示" */
  requirement?: string;
  choices: Choice[];
}

/** 题目生成器：传入随机源，产出一道题（含正确答案 + 1~3 个误区干扰项） */
export type QuestionGenerator = (rng: () => number) => Question;

/** 一个可考核的知识点（一次快问快答的单位） */
export interface Skill {
  id: string;
  title: string;
  /** 点击进入前的引导文案：考核什么、怎么考 */
  intro: string[];
  /** 每题基准限时（秒）：闯关模式直接用，复习 ×1.5，进阶 ×0.6 */
  timeLimitSec: number;
  /** 一局题数（闯关/进阶）；复习模式固定 20 题 */
  questionCount: number;
  /** false 时不出现在复习模式（填空对"比大小"这类三选一题无意义） */
  supportsReview?: boolean;
  /** true 时复习模式键盘增加负号键（正负数运算题库） */
  allowNegative?: boolean;
  /** true 时复习模式答案 >1 同时接受假分数和带分数（四则组合检验题库放宽） */
  acceptImproper?: boolean;
  /** true 时复习模式接受未约分的正确答案（通分题答案必须保留同分母） */
  allowUnreduced?: boolean;
  /** true 时复习模式键盘裁掉分数线/带分数键（答案只有整数/小数的题库，减少按钮防溢出） */
  numericKeypad?: boolean;
  /** true 时复习模式键盘裁掉带分数空格键（答案永远不会是带分数的题库，如倒数） */
  hideMixedKey?: boolean;
  generators: QuestionGenerator[];
}

/** 快问快答三模式 */
export type QuizMode = 'review' | 'normal' | 'advanced';

/** 各模式的题量与限时换算 */
export function modeParams(skill: Skill, mode: QuizMode): { count: number; timeLimitSec: number } {
  if (mode === 'review')
    return { count: 20, timeLimitSec: Math.round(skill.timeLimitSec * 1.5) };
  if (mode === 'advanced')
    return { count: skill.questionCount, timeLimitSec: Math.max(4, Math.round(skill.timeLimitSec * 0.6)) };
  return { count: skill.questionCount, timeLimitSec: skill.timeLimitSec };
}

export interface Unit {
  id: string;
  title: string;
  skills: Skill[];
}

export interface Grade {
  id: string;
  title: string;
  units: Unit[];
  /** false 表示占位（即将上线），用于演示分年级扩展结构 */
  available: boolean;
}

/** 小游戏描述（积分消耗 + 排行榜元信息） */
export interface MiniGameMeta {
  id: string;
  title: string;
  icon: string;
  /** 训练的能力维度 */
  ability: '专注力' | '记忆力' | '反应力';
  entryFee: number;
  description: string;
  /** 排行榜分数越大越好 */
  scoreLabel: string;
  /** 6 个关卡的展示信息（玩法配置在各游戏组件内） */
  levels: { title: string; hint: string }[];
  /** 可选：自定义关卡锁定规则（如 HGE2 跳过占位关），缺省按进度顺序解锁 */
  levelLocked?: (grades: Record<string, string>, index: number) => boolean;
  /** 可选：整个游戏卡的锁定原因（如 HGE2 进阶档需先通关上一档），返回 null 表示未锁定 */
  gameLocked?: () => string | null;
}
