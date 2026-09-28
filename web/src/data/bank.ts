/**
 * 题库注册表 —— 数据驱动的年级/单元/知识点树。
 * 扩展方式：写一个 Skill（引导文案 + 限时 + 题数 + 生成器数组），挂到 Unit 下即可，
 * 快问快答引擎、计分、积分入账全部自动复用。
 */
import type { Grade, MathExpr, Question, QuestionGenerator, Skill, Choice } from '@/core/types';
import { exprKey, exprValue } from '@/core/types';

/* ---------------- 随机工具 ---------------- */

/** mulberry32：可播种的随机源，便于将来复盘/复现一局题目 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let qid = 0;
function makeQuestion(
  prompt: MathExpr,
  requirement: string,
  correct: MathExpr,
  traps: { value: MathExpr; trap: string }[],
): Question {
  // 防御性去重：剔除与正确答案相同的干扰项，并按表达式去重，保证选项互不重复
  const seen = new Set<string>([exprKey(correct)]);
  const cleanTraps = traps.filter((t) => {
    const k = exprKey(t.value);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // 固定保留 3 个干扰项（选项总数 4）；生成器必须提供 ≥3 个可用候选，校验器负责兜底检查
  const kept = shuffle(rngGlobal, cleanTraps).slice(0, Math.min(cleanTraps.length, 3));
  const choices: Choice[] = shuffle(rngGlobal, [
    { id: 'c', value: correct, correct: true },
    ...kept.map((t, i) => ({ id: `t${i}`, value: t.value, correct: false, trap: t.trap })),
  ]);
  return { id: `q${++qid}`, prompt, requirement, choices };
}
// makeQuestion 内部洗牌用的全局随机源（每次生成题目前由生成器重置）
let rngGlobal: () => number = Math.random;

const frac = (n: number | string, d: number | string): MathExpr => ({
  kind: 'frac',
  n: String(n),
  d: String(d),
});
const text = (t: string): MathExpr => ({ kind: 'text', text: t });
const mixed = (w: number, n: number, d: number): MathExpr => ({
  kind: 'mixed',
  whole: String(w),
  n: String(n),
  d: String(d),
});

type Trap = { value: MathExpr; trap: string };

/* ---------------- 六年级 · 有理数：小数 ⇄ 分数 ---------------- */

/** 常考分母根：均匀抽取（1/2、1/4、1/5、1/8、1/10 的分母） */
const DENOMINATORS = [2, 4, 5, 8, 10];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** 某分母下所有满足最简的分子（剔除可约分的） */
function coprimeNumerators(d: number): number[] {
  const list: number[] = [];
  for (let n = 1; n < d; n++) if (gcd(n, d) === 1) list.push(n);
  return list;
}

/** 随机分子：1~d-1 中只保留与分母互质的（可约分的一律剔除） */
function randomNumerator(rng: () => number, d: number, exclude?: number): number {
  const candidates = coprimeNumerators(d).filter((n) => n !== exclude);
  return pick(rng, candidates);
}

/** 带整数题的整数部分：1~10 占 50%，11~100 占 50% */
function randomWhole(rng: () => number): number {
  return rng() < 0.5 ? 1 + Math.floor(rng() * 10) : 11 + Math.floor(rng() * 90);
}

/**
 * n/d（可带整数部分）的精确小数字符串。
 * 仅支持能整除 1000 的分母（2,4,5,8,10）；其他分母返回空串，调用方必须换用分数形态兜底。
 * 全程整数运算，避免浮点误差。
 */
function fracToDecimalText(n: number, d: number, whole = 0): string {
  if (1000 % d !== 0) return ''; // 除不尽的分母（如 3）禁止走小数形态
  const scaled = whole * 1000 + n * (1000 / d); // 放大 1000 倍的整数
  const s = String(scaled).padStart(4, '0');
  const out = `${s.slice(0, -3)}.${s.slice(-3)}`;
  return out.replace(/0+$/, '').replace(/\.$/, '');
}

/** 小数文本 → 未约分形式的分数（如 0.375 → 375/1000） */
function decimalToUnreducedFrac(decText: string): MathExpr {
  const [intPart, fracDigits] = decText.split('.');
  const denominator = Math.pow(10, fracDigits.length);
  const numerator = Number(intPart) * denominator + Number(fracDigits);
  return frac(numerator, denominator);
}

/**
 * 本类别的独立题库/干扰项思路（小数 ⇄ 分数转换）：
 * - 题库：分母 {2,4,5,8,10} 均匀、分子互质随机、可约分剔除、带整数题整数部分 1~10 与 11~100 各半
 * - 干扰项误区池：未约分等价 / 分子看错 / 分母看错 / 分子分母颠倒 / 数位拼接 / 小数点错位 / 漏整数部分 / 相等假分数（形式不符）
 * - 兜底铁律：任何参数组合下可用误区必须 ≥3（如 d=2 时"分子看错"不可用，由其他误区补上）
 */

/** 分子看错的候选（需要同分母下还有别的互质分子，d=2 时没有） */
function altNumerators(d: number, n: number): number[] {
  return coprimeNumerators(d).filter((x) => x !== n);
}
/** 分母看错的候选（≠d、大于分子、与分子互质） */
function altDenominators(d: number, n: number): number[] {
  return DENOMINATORS.filter((x) => x !== d && n < x && gcd(n, x) === 1);
}

/** 题型 A：纯小数 → 最简分数 */
const genDecimalToFraction: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const dec = fracToDecimalText(n, d);
  const traps: Trap[] = [
    // 误区 1：未约分——数值相等但不是最简（如 0.125 → 125/1000）
    { value: decimalToUnreducedFrac(dec), trap: '数值相等但没有约成最简分数，还要继续约分' },
    // 误区 2：分子分母颠倒（如 0.75 → 4/3）
    { value: frac(d, n), trap: '分子分母写反了，真分数的值小于 1' },
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: frac(pick(rng, n2s), d), trap: '分子看错了，再仔细数一数小数部分的值' });
  const d2s = altDenominators(d, n);
  if (d2s.length)
    traps.push({ value: frac(n, pick(rng, d2s)), trap: '分母看错了' });
  return makeQuestion(text(dec), '用最简分数表示', frac(n, d), traps);
};

/** 题型 B：纯分数 → 小数 */
const genFractionToDecimal: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const ans = fracToDecimalText(n, d);
  const traps: Trap[] = [
    // 误区 1：数位拼接——把 3/8 直接写成 0.38
    { value: text(`0.${n}${d}`), trap: '不能把分子分母直接拼在小数点后，要算出分数的值' },
    // 误区 2：小数点错位（0.625 → 0.0625）
    { value: text(`0.0${ans.slice(2)}`), trap: '小数点位置错了，注意这个分数不到 1 但也没那么小' },
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: text(fracToDecimalText(pick(rng, n2s), d)), trap: '分子看错了' });
  const d2s = altDenominators(d, n);
  if (d2s.length)
    traps.push({ value: text(fracToDecimalText(n, pick(rng, d2s))), trap: '分母看错了' });
  return makeQuestion(frac(n, d), '用小数表示', text(ans), traps);
};

/** 题型 C：带整数的小数 → 带分数（分数部分最简） */
const genMixedDecimalToFraction: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const w = randomWhole(rng);
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const dec = fracToDecimalText(n, d, w);
  // 小数部分对应的未约分分子/分母（如 1.75 → 75/100）
  const fracDigits = dec.split('.')[1];
  const denominator = Math.pow(10, fracDigits.length);
  const unreducedN = Number(fracDigits);
  const traps: Trap[] = [
    // 误区 1：分数部分未约分（如 1.75 → 1又75/100）
    { value: mixed(w, unreducedN, denominator), trap: '分数部分数值相等但没有约成最简，还要继续约分' },
    // 误区 2：写成相等的假分数——数值对但不是题目要求的形式
    { value: frac(w * d + n, d), trap: '这是相等的假分数，但题目要求带分数形式' },
    // 误区 3：整数部分看错
    { value: mixed(w + 1, n, d), trap: '整数部分看错了' },
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: mixed(w, pick(rng, n2s), d), trap: '小数部分的分子看错了' });
  return makeQuestion(text(dec), '用带分数表示（分数部分最简）', mixed(w, n, d), traps);
};

/** 题型 D：带分数 → 小数 */
const genMixedFractionToDecimal: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const w = randomWhole(rng);
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const traps: Trap[] = [
    // 误区 1：数位拼接——把 1又3/4 直接写成 1.34
    { value: text(`${w}.${n}${d}`), trap: '不能把分子分母直接拼在小数点后，要先算分数部分的值' },
    // 误区 2：只取了分数部分，丢了整数
    { value: text(fracToDecimalText(n, d)), trap: '漏掉了整数部分' },
    // 误区 3：整数部分看错
    { value: text(fracToDecimalText(n, d, w + 1)), trap: '整数部分看错了' },
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: text(fracToDecimalText(pick(rng, n2s), d, w)), trap: '分子看错了' });
  return makeQuestion(mixed(w, n, d), '用小数表示', text(fracToDecimalText(n, d, w)), traps);
};

const rationalConvertSkill: Skill = {
  id: 'g6-rational-convert',
  title: '小数 ⇄ 分数转换',
  intro: [
    '考核点：小数与分数双向转换，纯小数 / 纯分数 / 带整数小数 / 带分数四类均匀出题',
    '分母围绕常考的 2、4、5、8、10，分子随机（保证最简），带整数题整数部分 1~100',
    '小数 → 分数：写成最简分数或带分数（例如 0.125 = ⅛，1.75 = 1¾）',
    '每题限时 10 秒，答错扣分，连续答对有加成——不要瞎猜！',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  // 四个类别轮转，一局内均匀分配
  generators: [
    genDecimalToFraction,
    genFractionToDecimal,
    genMixedDecimalToFraction,
    genMixedFractionToDecimal,
  ],
};

/* ---------------- 六年级 · 数感基础（P1：原子能力训练） ---------------- */

/** 改写用的分母与随机参数：分母 2/3/4/5/6/8，整数部分 1~6，余数与分母互质 */
const REWRITE_DENOMINATORS = [2, 3, 4, 5, 6, 8];
function randomRewriteParams(rng: () => number) {
  const d = pick(rng, REWRITE_DENOMINATORS);
  const r = randomNumerator(rng, d);
  const w = 1 + Math.floor(rng() * 6);
  return { d, r, w, n: w * d + r };
}

/** A2-a 分数改写：假分数 → 带分数（如 7/6 = 1⅙）
 *  干扰项误区池：余数看错 / 商大 1 / 商小 1 / 漏整数部分 / 颠倒成真分数 */
const genImproperToMixed: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  const traps: Trap[] = [
    { value: mixed(w + 1, r, d), trap: '商算大了，分一分数里面有几个分母' },
    { value: frac(r, d), trap: '漏掉了整数部分' },
    { value: frac(d, n), trap: '分子分母写反了，假分数的值大于 1' },
  ];
  const r2s = altNumerators(d, r);
  if (r2s.length)
    traps.push({ value: mixed(w, pick(rng, r2s), d), trap: '余数算错了：商 × 分母 + 余数 = 分子' });
  if (w >= 2)
    traps.push({ value: mixed(w - 1, r, d), trap: '商算小了，剩下的部分还够再分一份' });
  return makeQuestion(frac(n, d), '用带分数表示', mixed(w, r, d), traps);
};

/** A2-b 分数改写：带分数 → 假分数（如 2⅓ = 7/3）
 *  干扰项误区池：整数+分子直接相加 / 分子算错 / 漏整数部分 / 商大 1 */
const genMixedToImproper: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  const traps: Trap[] = [
    { value: frac(w + r, d), trap: '整数部分要先乘分母再加分子，不是直接相加' },
    { value: frac(r, d), trap: '漏掉了整数部分' },
    { value: frac((w + 1) * d + r, d), trap: '整数部分看错了，多数了一份' },
  ];
  const r2s = altNumerators(d, r);
  if (r2s.length)
    traps.push({ value: frac(w * d + pick(rng, r2s), d), trap: '分子算错了：整数 × 分母 + 原分子' });
  return makeQuestion(mixed(w, r, d), '用假分数表示', frac(n, d), traps);
};

/** A3 约分训练（如 2/4 = 1/2，25/75 = 1/3）
 *  干扰项误区池：没约干净（每个真因子一种）/ 只约分母 / 只约分子 / 分子分母减同数 */
const genSimplify: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  // 先定最简分数，再乘倍数 k 得到题面；k 必须有真因子，才能造"没约干净"的干扰项
  const MULTIPLIERS = [4, 6, 8, 9, 10, 15, 25];
  let n = 1, d = 2, k = 4;
  for (let tries = 0; tries < 50; tries++) {
    const td = pick(rng, [3, 4, 5, 6, 7, 8, 9]);
    const tn = randomNumerator(rng, td);
    const tk = pick(rng, MULTIPLIERS);
    if (td * tk <= 100) {
      n = tn;
      d = td;
      k = tk;
      break;
    }
  }
  // k 的每个真因子对应一种"只约了一部分"的中间态
  const partials = [2, 3, 5]
    .filter((f) => k % f === 0 && k / f > 1)
    .map((f) => ({
      value: frac(n * (k / f), d * (k / f)),
      trap: '没约干净，要约到分子分母互质为止',
    }));
  const traps: Trap[] = [
    ...partials,
    { value: frac(n, d * k), trap: '只约了分母，分子也要除以同一个数' },
    { value: frac(n * k, d), trap: '只约了分子，分母也要除以同一个数' },
    { value: frac(n * k - 1, d * k - 1), trap: '分子分母要除以同一个数，不是减去同一个数' },
  ];
  return makeQuestion(frac(n * k, d * k), '约成最简分数', frac(n, d), traps);
};

/** B1 大小比较：分数 vs 分数、小数 vs 分数，约 20% 为等值变形
 *  干扰项误区池：选成更小的一边 / 误判相等（本题结构只有"左边大/右边大/一样大"三种答案，
 *  是本类别独立的题型逻辑，固定 3 个选项）
 *  注意：小数形态只允许能整除 1000 的分母（2,4,5,8,10），分母 3 走等值分数形态兜底 */
const CMP_DENOMINATORS = [2, 3, 4, 5, 8, 10];
const DECIMAL_OK = [2, 4, 5, 8, 10];
const genCompare: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const equal = rng() < 0.2;
  const d1 = pick(rng, CMP_DENOMINATORS);
  const n1 = randomNumerator(rng, d1);
  const left: MathExpr = frac(n1, d1);
  let right: MathExpr;
  if (equal) {
    // 等值不同形态：优先换成小数；除不尽的分母（3）换成等值分数（如 1/3 → 2/6）
    right = DECIMAL_OK.includes(d1)
      ? text(fracToDecimalText(n1, d1))
      : frac(n1 * 2, d1 * 2);
  } else {
    const crossForm = rng() < 0.4;
    // 制造"接近但不同"的值，逼出数感而非硬算
    for (let tries = 0; tries < 50; tries++) {
      const d2 = pick(rng, CMP_DENOMINATORS);
      const n2 = randomNumerator(rng, d2);
      if (d1 === d2 && n1 === n2) continue;
      const v1 = n1 / d1;
      const v2 = n2 / d2;
      if (v1 === v2) continue;
      if (Math.abs(v1 - v2) > 0.3) continue; // 差太多没有训练价值
      // 跨形态（分数 vs 小数）只在除得尽时使用
      right = crossForm && DECIMAL_OK.includes(d2) ? text(fracToDecimalText(n2, d2)) : frac(n2, d2);
      break;
    }
    // 极端兜底（理论上到不了）
    right ??= frac(randomNumerator(rng, 8, n1 === 1 ? 1 : undefined), 8);
  }
  const vL = n1 / d1;
  const vR = exprValue(right);
  const isEqual = Math.abs(vL - vR) < 1e-9;
  const sameText = text('一样大');
  const prompt: MathExpr = { kind: 'vs', left, right };
  if (isEqual) {
    const traps: Trap[] = [
      { value: left, trap: '两边其实相等' },
      { value: right, trap: '两边其实相等' },
    ];
    return makeQuestion(prompt, '哪边更大？', sameText, traps);
  }
  const bigger = vL > vR ? left : right;
  const smaller = vL > vR ? right : left;
  const traps: Trap[] = [
    { value: smaller, trap: '这个更小，可以在心里先换成同一种形式再比' },
    { value: sameText, trap: '两边不相等，差得不多，仔细比' },
  ];
  return makeQuestion(prompt, '哪边更大？', bigger, traps);
};

const rewriteSkill: Skill = {
  id: 'g6-sense-rewrite',
  title: '分数改写',
  intro: [
    '考核点：假分数 ⇄ 带分数互化（数感原子能力 A2）',
    '假分数 → 带分数：分子 ÷ 分母，商是整数部分、余数是分子（例如 7/6 = 1⅙）',
    '带分数 → 假分数：整数 × 分母 + 分子（例如 2⅓ = 7/3）',
    '每题限时 10 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  generators: [genImproperToMixed, genMixedToImproper],
};

const simplifySkill: Skill = {
  id: 'g6-sense-simplify',
  title: '约分训练',
  intro: [
    '考核点：把分数约成最简形式（数感原子能力 A3）',
    '分子分母同时除以公因数，一直约到互质为止（例如 25/75 = 1/3）',
    '小心"没约干净"的选项——约了一半不算对！',
    '每题限时 10 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  generators: [genSimplify],
};

const compareSkill: Skill = {
  id: 'g6-sense-compare',
  title: '大小比较',
  intro: [
    '考核点：不硬算，凭数感比较分数/小数大小（数感原子能力 B1）',
    '技巧：在心里把两边换成同一种形式再比（例如 ⅝ = 0.625 > 0.6）',
    '约两成题目两边其实相等——不要被不同写法骗了！',
    '每题限时 8 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 8,
  questionCount: 10,
  // 三选一题型不适合填空，复习模式不出
  supportsReview: false,
  generators: [genCompare],
};

/* ---------------- 六年级 · 分数运算（P2：两项 90% + 三项 10%） ---------------- */

/**
 * 本类别的独立题库/干扰项思路（分数加减乘除速算）：
 * - 题库：两项 90% + 三项连算 10%（三项只出同分母加减/连乘/连除，保持速算定位）
 *   加减：同分母 50% + 异分母 50%（异分母中 70% 倍数关系好通分、30% 互质）
 *   乘除：真分数 / 整数×分数 / 带分数×分数 三形态均匀；减法保证结果为正（P2 不出负数）
 * - 答案一律最简；结果 >1 用带分数（复用 A2 改写能力）
 * - 干扰项误区池：见各生成器注释；形态类陷阱（未约分/假分数）故意数值相等，考验形式要求
 * - 兜底铁律：任何参数组合下可用误区 ≥3；非形态类陷阱若数值恰等于答案会被剔除
 */

const ARITH_DENOMS = [2, 3, 4, 5, 6, 8];
const MULTIPLE_PAIRS: [number, number][] = [[2, 4], [2, 6], [3, 6], [2, 8], [4, 8]];
const COPRIME_PAIRS: [number, number][] = [[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [5, 6]];

const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
const reduce2 = (n: number, d: number): [number, number] => {
  const g = gcd(Math.abs(n), Math.abs(d));
  return [n / g, d / g];
};

/** 运算结果 → MathExpr：整数 → text；>1 → 带分数；其余 → 最简分数 */
function ansExpr(n: number, d: number): MathExpr {
  const [rn, rd] = reduce2(n, d);
  if (rn % rd === 0) return text(String(rn / rd));
  if (rn < rd) return frac(rn, rd);
  return mixed(Math.floor(rn / rd), rn % rd, rd);
}

/** 未约分形态干扰项（数值故意相等，考验"要约到最简"） */
function unreducedExpr(n: number, d: number): MathExpr {
  if (n % d === 0) return text(String(n / d));
  if (n < d) return frac(n, d);
  return mixed(Math.floor(n / d), n % d, d);
}

/** 加陷阱：非形态类陷阱若数值恰等于正确答案则剔除（allowEqual 的形态类陷阱除外） */
function pushTrap(traps: Trap[], value: MathExpr, trap: string, correctVal: number, allowEqual = false) {
  if (!allowEqual && Math.abs(exprValue(value) - correctVal) < 1e-9) return;
  traps.push({ value, trap });
}

/** 形态类陷阱：可约分时出"未约分等价"（数值故意相等，考形式要求）。
 *  注：假分数形式陷阱已随"四则答案放宽（假分数/带分数都算对）"从运算题库移除 */
function formTraps(traps: Trap[], N: number, D: number) {
  if (gcd(N, D) > 1)
    traps.push({ value: unreducedExpr(N, D), trap: '数值相等但没有约成最简，还要继续约分' });
}

/** 兜底：干扰项候选不足 4 个时，用"差一点点"的邻值补齐（保证键不重复、值≠答案） */
function fillTraps(traps: Trap[], N: number, D: number) {
  const correctVal = N / D;
  const keys = new Set(traps.map((t) => exprKey(t.value)));
  const cands: [number, number][] = [
    [N + 1, D], [N, D + 1], [N, D * 2], [N * 2, D * 2 + 1], [N + 1, D * 2],
    [N + 2, D], [N * 2 + 1, D * 2], [N, D * 3], [N + 3, D],
  ];
  for (const [n, d] of cands) {
    if (keys.size >= 4) break;
    const v = frac(n, d);
    const k = exprKey(v);
    if (keys.has(k) || Math.abs(exprValue(v) - correctVal) < 1e-9) continue;
    keys.add(k);
    traps.push({ value: v, trap: '差一点点，再仔细算一遍' });
  }
}

/** 加减法两项的分母/分子组合：同分母 50%，异分母中 70% 倍数关系、30% 互质 */
function pickAddSubPair(rng: () => number): { d1: number; d2: number; n1: number; n2: number } {
  let d1: number, d2: number;
  const r = rng();
  if (r < 0.5) {
    d1 = d2 = pick(rng, ARITH_DENOMS);
  } else if (r < 0.85) {
    const p = pick(rng, MULTIPLE_PAIRS);
    [d1, d2] = rng() < 0.5 ? p : [p[1], p[0]];
  } else {
    const p = pick(rng, COPRIME_PAIRS);
    [d1, d2] = rng() < 0.5 ? p : [p[1], p[0]];
  }
  return { d1, d2, n1: randomNumerator(rng, d1), n2: randomNumerator(rng, d2) };
}

/** 分数加法：干扰项 = 分母也加/分子忘乘倍数/把加法算成乘法 + 形态陷阱 */
const genFracAdd: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    // 三项同分母连加
    const d = pick(rng, ARITH_DENOMS);
    const ns = [randomNumerator(rng, d), randomNumerator(rng, d), randomNumerator(rng, d)];
    const N = ns[0] + ns[1] + ns[2];
    const traps: Trap[] = [
      { value: frac(N, d * 3), trap: '同分母连加，分母不变，不是把分母也加起来' },
      { value: frac(N - 1, d), trap: '漏加了一个分子，再数一数' },
      { value: frac(N + 1, d), trap: '分子加错了，再算一遍' },
    ];
    formTraps(traps, N, d);
  fillTraps(traps, N, d);
    return makeQuestion(
      { kind: 'op', op: '+', terms: ns.map((n) => frac(n, d)) },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, d),
      traps,
    );
  }
  const { d1, d2, n1, n2 } = pickAddSubPair(rng);
  const D = lcm(d1, d2);
  const N = n1 * (D / d1) + n2 * (D / d2);
  const traps: Trap[] = [];
  if (d1 === d2) {
    pushTrap(traps, frac(N, d1 * 2), '同分母相加，分母不变，不是把分母也加起来', N / D);
    pushTrap(traps, frac(N + 1, d1), '分子加错了，再算一遍', N / D);
  } else {
    pushTrap(traps, frac(n1 + n2, d1 + d2), '异分母相加要先通分，不能把分子分母分别相加', N / D);
    pushTrap(traps, frac(n1 + n2, D), '通分后分子也要乘同样的倍数', N / D);
  }
  pushTrap(traps, ansExpr(n1 * n2, d1 * d2), '把加法算成乘法了', N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '+', terms: [frac(n1, d1), frac(n2, d2)] },
    '计算，结果约到最简（假分数或带分数均可）',
    ansExpr(N, D),
    traps,
  );
};

/** 分数减法：保证结果为正；干扰项 = 分别相减/分子忘乘倍数/把减法算成加法/借位错 + 形态陷阱 */
const genFracSub: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const r = rng();
  if (r < 0.1) {
    // 三项同分母连减：保证 n1 > n2 + n3（分母只取互质分子 ≥3 个的）
    const d = pick(rng, [4, 5, 6, 8]);
    const cs = coprimeNumerators(d); // 升序
    const lo = cs[0];
    const n1 = pick(rng, cs.filter((n) => n > 2 * lo));
    const n2 = pick(rng, cs.filter((n) => n < n1 - lo));
    const n3 = pick(rng, cs.filter((n) => n < n1 - n2));
    const N = n1 - n2 - n3;
    const traps: Trap[] = [];
    pushTrap(traps, frac(n1 - n2 + n3, d), '符号看错了：两个减号都要减', N / d);
    pushTrap(traps, frac(n1 + n2 + n3, d), '把减法算成加法了', N / d);
    pushTrap(traps, frac(N + 1, d), '分子减错了，再算一遍', N / d);
    pushTrap(traps, frac(n1, d), '后两个数都没减', N / d);
    formTraps(traps, N, d);
  fillTraps(traps, N, d);
    return makeQuestion(
      { kind: 'op', op: '-', terms: [frac(n1, d), frac(n2, d), frac(n3, d)] },
      '计算，结果用最简分数表示',
      ansExpr(N, d),
      traps,
    );
  }
  if (r < 0.35) {
    // 整数 − 分数（练借位）
    const w = 2 + Math.floor(rng() * 4);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N = w * d - n;
    const traps: Trap[] = [];
    pushTrap(traps, mixed(w - 1, n, d), '整数要借 1 变成同分母分数再减', N / d);
    pushTrap(traps, ansExpr(w * d + n, d), '把减法算成加法了', N / d);
    pushTrap(traps, mixed(w, n, d), '整数部分也要减，不是照抄', N / d);
    pushTrap(traps, frac(N + 1, d), '分子算错了，再算一遍', N / d);
    formTraps(traps, N, d);
  fillTraps(traps, N, d);
    return makeQuestion(
      { kind: 'op', op: '-', terms: [text(String(w)), frac(n, d)] },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, d),
      traps,
    );
  }
  // 两项分数相减：重roll 保证被减数严格更大（杜绝差为 0 / 排除法空候选）
  let pair = pickAddSubPair(rng);
  for (let t = 0; t < 60 && pair.n1 / pair.d1 === pair.n2 / pair.d2; t++) pair = pickAddSubPair(rng);
  let { d1, d2, n1, n2 } = pair;
  if (n1 / d1 < n2 / d2) {
    [d1, d2] = [d2, d1];
    [n1, n2] = [n2, n1];
  }
  const D = lcm(d1, d2);
  const N = n1 * (D / d1) - n2 * (D / d2);
  const traps: Trap[] = [];
  if (d1 === d2) {
    pushTrap(traps, frac(N + 1, d1), '分子减错了，再算一遍', N / D);
    pushTrap(traps, frac(n1 + n2, d1), '把减法算成加法了', N / D);
    pushTrap(traps, frac(n2, d1), '只抄了减数，被减数没用上', N / D);
    pushTrap(traps, frac(n1, d1), '只抄了被减数，忘记减', N / D);
    pushTrap(traps, frac(N, d1 * 2), '同分母相减，分母不变，不要翻倍', N / D);
  } else {
    if (Math.abs(n1 - n2) > 0)
      pushTrap(traps, frac(Math.abs(n1 - n2), Math.abs(d1 - d2)), '异分母相减要先通分，不能把分子分母分别相减', N / D);
    if (n1 > n2) pushTrap(traps, frac(n1 - n2, D), '通分后分子也要乘同样的倍数', N / D);
    pushTrap(traps, frac(n1 * (D / d1), D), '第二个数忘通分了，两个分子都要乘倍数', N / D);
    pushTrap(traps, frac(n2 * (D / d2), D), '只算了第二个数，不是减', N / D);
    pushTrap(traps, ansExpr(n1 * (D / d1) + n2 * (D / d2), D), '把减法算成加法了', N / D);
  }
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '-', terms: [frac(n1, d1), frac(n2, d2)] },
    '计算，结果用最简分数表示',
    ansExpr(N, D),
    traps,
  );
};

/** 乘法三形态：真×真 / 整数×分数 / 带分数×分数 均匀 */
function pickMulForm(rng: () => number): number {
  const r = rng();
  return r < 1 / 3 ? 0 : r < 2 / 3 ? 1 : 2;
}

/** 分数乘法：干扰项 = 误用倒数/只乘分子/整数加分子/带分数整数忘乘/把乘法算成加法 + 形态陷阱 */
const genFracMul: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    // 三项连乘（真分数）
    const f = [0, 0, 0].map(() => {
      const d = pick(rng, ARITH_DENOMS);
      return { n: randomNumerator(rng, d), d };
    });
    const N = f[0].n * f[1].n * f[2].n;
    const D = f[0].d * f[1].d * f[2].d;
    const L = lcm(lcm(f[0].d, f[1].d), f[2].d);
    const sum = f.reduce((s, x) => s + x.n * (L / x.d), 0);
    const traps: Trap[] = [];
    pushTrap(traps, frac(N, f[0].d * f[1].d), '连乘要把所有分母都乘起来', N / D);
    pushTrap(traps, ansExpr(sum, L), '把连乘算成连加了', N / D);
    pushTrap(traps, frac(N, D + 1), '分母乘错了，再算一遍', N / D);
    pushTrap(traps, frac(N + 1, D), '分子乘错了，再算一遍', N / D);
    formTraps(traps, N, D);
  fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: '×', terms: f.map((x) => frac(x.n, x.d)) },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, D),
      traps,
    );
  }
  const form = pickMulForm(rng);
  if (form === 0) {
    const d1 = pick(rng, ARITH_DENOMS);
    const d2 = pick(rng, ARITH_DENOMS);
    const n1 = randomNumerator(rng, d1);
    const n2 = randomNumerator(rng, d2);
    const N = n1 * n2;
    const D = d1 * d2;
    const traps: Trap[] = [];
    pushTrap(traps, ansExpr(n1 * d2, d1 * n2), '乘法不需要倒数，那是除法的做法', N / D);
    pushTrap(traps, frac(N, d1), '分母也要相乘', N / D);
    pushTrap(traps, ansExpr(n1 * d2 + n2 * d1, d1 * d2), '把乘法算成加法了', N / D);
    formTraps(traps, N, D);
  fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: '×', terms: [frac(n1, d1), frac(n2, d2)] },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, D),
      traps,
    );
  }
  if (form === 1) {
    const k = 2 + Math.floor(rng() * 8);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N = k * n;
    const traps: Trap[] = [];
    pushTrap(traps, frac(n, d * k), '整数要乘分子，不是乘分母', N / d);
    pushTrap(traps, frac(k + n, d), '整数要乘分子，不是加分子', N / d);
    pushTrap(traps, frac(n, d), '忘记乘整数了', N / d);
    formTraps(traps, N, d);
  fillTraps(traps, N, d);
    return makeQuestion(
      { kind: 'op', op: '×', terms: [text(String(k)), frac(n, d)] },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, d),
      traps,
    );
  }
  // 带分数 × 分数
  const w = 1 + Math.floor(rng() * 5);
  const d1 = pick(rng, ARITH_DENOMS);
  const n1 = randomNumerator(rng, d1);
  const d2 = pick(rng, ARITH_DENOMS);
  const n2 = randomNumerator(rng, d2);
  const a = w * d1 + n1;
  const N = a * n2;
  const D = d1 * d2;
  const traps: Trap[] = [];
  {
    const [rn, rd] = reduce2(n1 * n2, d1 * d2);
    pushTrap(traps, mixed(w, rn, rd), '整数部分也要乘：先把带分数化成假分数再乘', N / D);
  }
  pushTrap(traps, frac(N, d1), '分母也要相乘', N / D);
  pushTrap(traps, ansExpr(a * d2, d1 * n2), '乘法不需要倒数，那是除法的做法', N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '×', terms: [mixed(w, n1, d1), frac(n2, d2)] },
    '计算，结果约到最简（假分数或带分数均可）',
    ansExpr(N, D),
    traps,
  );
};

/** 分数除法：内嵌 C4 倒数；干扰项 = 忘倒直接乘/倒错对象/漏整数部分 + 形态陷阱 */
const genFracDiv: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    // 三项连除（真分数，左结合 a÷b÷c）
    const f = [0, 0, 0].map(() => {
      const d = pick(rng, ARITH_DENOMS);
      return { n: randomNumerator(rng, d), d };
    });
    const N = f[0].n * f[1].d * f[2].d;
    const D = f[0].d * f[1].n * f[2].n;
    const traps: Trap[] = [];
    pushTrap(traps, ansExpr(f[0].n * f[1].d * f[2].n, f[0].d * f[1].n * f[2].d), '连除要把每个除数都倒过来乘', N / D);
    pushTrap(traps, ansExpr(f[0].n * f[1].n * f[2].n, f[0].d * f[1].d * f[2].d), '除以一个数 = 乘它的倒数', N / D);
    pushTrap(traps, ansExpr(f[0].n * f[1].n * f[2].d, f[0].d * f[1].d * f[2].n), '倒错对象了，看清哪个是除数', N / D);
    pushTrap(traps, frac(N, D + 1), '分母算错了，再算一遍', N / D);
    formTraps(traps, N, D);
  fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: '÷', terms: f.map((x) => frac(x.n, x.d)) },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, D),
      traps,
    );
  }
  const r = rng();
  if (r < 0.5) {
    // 真 ÷ 真
    const d1 = pick(rng, ARITH_DENOMS);
    const d2 = pick(rng, ARITH_DENOMS);
    const n1 = randomNumerator(rng, d1);
    const n2 = randomNumerator(rng, d2);
    const N = n1 * d2;
    const D = d1 * n2;
    const traps: Trap[] = [];
    pushTrap(traps, ansExpr(n1 * n2, d1 * d2), '除以分数 = 乘它的倒数，先把除数倒过来', N / D);
    pushTrap(traps, ansExpr(d1 * n2, n1 * d2), '倒错对象：要倒的是除数（÷ 后面的数）', N / D);
    pushTrap(traps, frac(n1 * d2 + 1, d1 * n2), '分子算错了，再算一遍', N / D);
    pushTrap(traps, frac(n1 * d2, d1 * n2 + 1), '分母算错了，再算一遍', N / D);
    formTraps(traps, N, D);
  fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: '÷', terms: [frac(n1, d1), frac(n2, d2)] },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, D),
      traps,
    );
  }
  if (r < 0.75) {
    // 整数 ÷ 分数
    const k = 2 + Math.floor(rng() * 8);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N = k * d;
    const traps: Trap[] = [];
    pushTrap(traps, ansExpr(k * n, d), '除以分数要乘它的倒数', N / n);
    pushTrap(traps, frac(n, k * d), '商写倒了：整数 ÷ 分数，结果应该更大', N / n);
    pushTrap(traps, frac(k, d * n), '要乘的是整个倒数', N / n);
    pushTrap(traps, frac(k, d), '只除了分母，分子没处理', N / n);
    pushTrap(traps, text(String(k)), '忘记除了，整数没有变化', N / n);
    formTraps(traps, N, n);
  fillTraps(traps, N, n);
    return makeQuestion(
      { kind: 'op', op: '÷', terms: [text(String(k)), frac(n, d)] },
      '计算，结果约到最简（假分数或带分数均可）',
      ansExpr(N, n),
      traps,
    );
  }
  // 带分数 ÷ 分数
  const w = 1 + Math.floor(rng() * 5);
  const d1 = pick(rng, ARITH_DENOMS);
  const n1 = randomNumerator(rng, d1);
  const d2 = pick(rng, ARITH_DENOMS);
  const n2 = randomNumerator(rng, d2);
  const a = w * d1 + n1;
  const N = a * d2;
  const D = d1 * n2;
  const traps: Trap[] = [];
  pushTrap(traps, ansExpr(a * n2, d1 * d2), '除以分数 = 乘它的倒数，先把除数倒过来', N / D);
  pushTrap(traps, ansExpr(n1 * d2, d1 * n2), '漏掉整数部分：先把带分数化成假分数再除', N / D);
  pushTrap(traps, ansExpr(w * d2, n2), '带分数要整体化假分数，不能只算整数部分', N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '÷', terms: [mixed(w, n1, d1), frac(n2, d2)] },
    '计算，结果约到最简（假分数或带分数均可）',
    ansExpr(N, D),
    traps,
  );
};

const fracAddSkill: Skill = {
  id: 'g6-frac-add',
  title: '分数加法',
  intro: [
    '考核点：分数加法速算（两项 90% + 三项连加 10%）',
    '同分母 50%：分母不变分子相加；异分母 50%：先通分再加（70% 分母成倍数关系）',
    '结果约到最简即可，假分数、带分数都算对（例如 1/2 + 3/4 = 5/4 或 1¼）',
    '小心陷阱：分母也加、通分忘乘分子、把加法算成乘法',
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracAdd],
};

const fracSubSkill: Skill = {
  id: 'g6-frac-sub',
  title: '分数减法',
  intro: [
    '考核点：分数减法速算（两项 90% + 三项连减 10%，结果保证为正）',
    '同分母 50%、异分母 50%，另有 25% 是整数减分数（练借位）',
    '结果约到最简即可，假分数、带分数都算对（例如 2 - 3/4 = 5/4 或 1¼）',
    '小心陷阱：分子分母分别相减、把减法算成加法、整数忘借位',
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracSub],
};

const fracMulSkill: Skill = {
  id: 'g6-frac-mul',
  title: '分数乘法',
  intro: [
    '考核点：分数乘法速算（两项 90% + 三项连乘 10%）',
    '三种形态均匀：真分数×真分数 / 整数×分数 / 带分数×分数',
    '结果约到最简即可，假分数、带分数都算对；能约分先约分更快（例如 3/4 × 2/3 = 1/2）',
    '小心陷阱：误用倒数（那是除法！）、只乘分子、带分数整数忘乘',
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracMul],
};

const fracDivSkill: Skill = {
  id: 'g6-frac-div',
  title: '分数除法',
  intro: [
    '考核点：分数除法速算（两项 90% + 三项连除 10%）',
    '口诀：除以一个数 = 乘它的倒数（倒的是 ÷ 后面的数！）',
    '结果约到最简即可，假分数、带分数都算对（例如 1½ ÷ 3/4 = 2）',
    '小心陷阱：忘倒直接乘、倒错对象、漏掉带分数的整数部分',
  ],
  timeLimitSec: 18,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracDiv],
};

/* ---------------- 六年级 · 有理数：正负数（P3：符号快闪 + 加减） ---------------- */

/**
 * 本类别的独立题库/干扰项思路：
 * - 符号快闪（C3）：只判结果正负不计算，固定 3 选项（正数/负数/等于 0），约 12% 恰为 0；
 *   两项 80% + 三项 20%，覆盖同号相加/异号相加/减负数等结构
 * - 正负数加减：两项 90% + 三项 10%（三项用代数和形式 a + (-b) + c）；整数 70% + 一位小数 30%；
 *   数值范围 ±20；减法含"减去负数"情形
 * - 干扰项误区池：符号看反 / 异号当同号（绝对值相加）/ 同号当异号（绝对值相减）/ 减法方向反 / 差一点点
 * - 全程"十分位整数"运算，避免浮点误差
 */

/** 十分位整数 → 显示文本（如 -35 → "-3.5"，200 → "20"） */
const fmtTenth = (t: number): string => {
  const sign = t < 0 ? '-' : '';
  const a = Math.abs(t);
  const i = Math.floor(a / 10);
  const f = a % 10;
  return sign + (f === 0 ? String(i) : `${i}.${f}`);
};

/** 有符号数：整数(±20) 或 一位小数(±9.9)，不含 0；返回十分位整数 */
function signedTenth(rng: () => number, decimal: boolean): number {
  if (decimal) {
    let t = Math.floor(rng() * 197) - 98; // -98..98
    if (t % 10 === 0) t += 1 + Math.floor(rng() * 8); // 避开整数位，保证是小数题
    return t;
  }
  let t = (Math.floor(rng() * 39) - 19) * 10; // ±19 的整数
  return t === 0 ? 10 : t;
}

/** 文本陷阱兜底：邻值补齐到 4 个不重复候选（键不重复、值≠答案） */
function fillTextTraps(traps: Trap[], rTenth: number) {
  const keys = new Set(traps.map((t) => exprKey(t.value)));
  for (const dt of [10, -10, 20, -20, 30, -30, 40, -40]) {
    if (keys.size >= 4) break;
    const v = text(fmtTenth(rTenth + dt));
    const k = exprKey(v);
    if (keys.has(k)) continue;
    keys.add(k);
    traps.push({ value: v, trap: '差一点点，再仔细算一遍' });
  }
}

function pushTextTrap(traps: Trap[], tTenth: number, trap: string, correctTenth: number) {
  if (tTenth === correctTenth) return;
  traps.push({ value: text(fmtTenth(tTenth)), trap });
}

/** 正负数加减 */
const genSignedAddSub: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    // 三项代数和：a + b + c（各项自带符号）
    const a = signedTenth(rng, false);
    const b = signedTenth(rng, false);
    const c = signedTenth(rng, false);
    const r = a + b + c;
    const traps: Trap[] = [];
    pushTextTrap(traps, -r, '符号看反了', r);
    pushTextTrap(traps, (Math.abs(a) + Math.abs(b) + Math.abs(c)) * (r >= 0 ? 1 : -1), '不能全当同号相加，负项要抵消', r);
    pushTextTrap(traps, a + b - c, '最后一项的符号看错了', r);
    fillTextTraps(traps, r);
    return makeQuestion(
      { kind: 'op', op: '+', terms: [text(fmtTenth(a)), text(fmtTenth(b)), text(fmtTenth(c))] },
      '计算（注意正负号）',
      text(fmtTenth(r)),
      traps,
    );
  }
  const decimal = rng() < 0.3;
  const a = signedTenth(rng, decimal);
  const b = signedTenth(rng, decimal);
  const isSub = rng() < 0.5;
  const r = isSub ? a - b : a + b;
  const traps: Trap[] = [];
  if (isSub) {
    pushTextTrap(traps, b - a, '方向反了：被减数 − 减数，不是倒过来减', r);
    pushTextTrap(traps, a + b, '减去一个数 = 加上它的相反数，符号要变', r);
    pushTextTrap(traps, -r, '符号看反了', r);
  } else if (a > 0 !== b > 0) {
    // 异号相加
    const bigSign = Math.abs(a) > Math.abs(b) ? Math.sign(a) : Math.sign(b);
    pushTextTrap(traps, bigSign * (Math.abs(a) + Math.abs(b)), '异号相加是绝对值抵消，不是相加', r);
    pushTextTrap(traps, -r, '符号看反了：跟绝对值大的数走', r);
    pushTextTrap(traps, (Math.abs(a) + Math.abs(b)) * -bigSign, '异号相加既算错又丢符号', r);
  } else {
    // 同号相加
    pushTextTrap(traps, Math.abs(a) - Math.abs(b), '同号相加，绝对值要相加，不是抵消', r);
    pushTextTrap(traps, -r, '同号相加符号不变', r);
  }
  fillTextTraps(traps, r);
  return makeQuestion(
    { kind: 'op', op: isSub ? '-' : '+', terms: [text(fmtTenth(a)), text(fmtTenth(b))] },
    '计算（注意正负号）',
    text(fmtTenth(r)),
    traps,
  );
};

/** 符号快闪：只判正负，固定 3 选项 */
const genSignFlash: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const pos = text('正数');
  const neg = text('负数');
  const zero = text('等于 0');
  const hint = '异号相加，符号跟绝对值大的数走；同号相加符号不变';
  // 12% 恰为 0：互为相反数
  if (rng() < 0.12) {
    const a = (1 + Math.floor(rng() * 15)) * 10;
    const first = rng() < 0.5;
    const terms = first ? [text(fmtTenth(-a)), text(fmtTenth(a))] : [text(fmtTenth(a)), text(fmtTenth(-a))];
    return makeQuestion(
      { kind: 'op', op: '+', terms },
      '不计算，判断结果是正还是负',
      zero,
      [
        { value: pos, trap: '这两个数互为相反数，相加等于 0' },
        { value: neg, trap: '这两个数互为相反数，相加等于 0' },
      ],
    );
  }
  const three = rng() < 0.2;
  const isSub = !three && rng() < 0.4;
  const a = signedTenth(rng, false);
  const b = signedTenth(rng, false);
  if (three) {
    const c = signedTenth(rng, false);
    const v = a + b + c;
    const correct = v > 0 ? pos : v < 0 ? neg : zero;
    // 干扰项永远是另外两个标签，避免与正确项重复
    const traps: Trap[] = [pos, neg, zero]
      .filter((x) => exprKey(x) !== exprKey(correct))
      .map((x) => ({
        value: x,
        trap: exprKey(x) === '等于 0' ? '三项不会恰好抵消，再估一估绝对值' : hint,
      }));
    return makeQuestion(
      { kind: 'op', op: '+', terms: [text(fmtTenth(a)), text(fmtTenth(b)), text(fmtTenth(c))] },
      '不计算，判断结果是正还是负',
      correct,
      traps,
    );
  }
  const v = isSub ? a - b : a + b;
  const correct = v > 0 ? pos : v < 0 ? neg : zero;
  const traps: Trap[] = [pos, neg, zero]
    .filter((x) => exprKey(x) !== exprKey(correct))
    .map((x) => ({
      value: x,
      trap:
        exprKey(x) === '等于 0'
          ? '两边绝对值不一样大，不会等于 0'
          : isSub
            ? '减去负数 = 加正数，方向想清楚'
            : hint,
    }));
  return makeQuestion(
    { kind: 'op', op: isSub ? '-' : '+', terms: [text(fmtTenth(a)), text(fmtTenth(b))] },
    '不计算，判断结果是正还是负',
    correct,
    traps,
  );
};

const signFlashSkill: Skill = {
  id: 'g6-sign-flash',
  title: '符号快闪',
  intro: [
    '考核点：不计算，只判断正负数加减结果的正负（数感原子能力 C3）',
    '口诀：同号相加符号不变；异号相加，符号跟绝对值大的走；减负数 = 加正数',
    '约一成题目结果恰好等于 0（互为相反数）',
    '限时很短，凭直觉秒杀！本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 5,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignFlash],
};

const signedAddSkill: Skill = {
  id: 'g6-signed-add',
  title: '正负数加减',
  intro: [
    '考核点：正负数加减速算（两项 90% + 三项代数和 10%）',
    '整数 70% + 一位小数 30%，范围 ±20；减法含"减去负数"',
    '先定符号再算绝对值：同号相加、异号抵消；减负数 = 加正数',
    '复习模式键盘有负号键，负数答案先按 − 再输数字',
  ],
  timeLimitSec: 15,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genSignedAddSub],
};

/* ---------------- 前置原子能力（五年级地基）：通分 / 交叉约分 / 倒数 ---------------- */

/**
 * 本类别独立题库/干扰项思路（一题只考一个原子，不做后续运算）：
 * - 通分快闪：异分母对（倍数关系 50% + 互质 50%），60% 问"某一边通分后变成哪个"、40% 问最小公分母；
 *   答案故意不约分（通分就是要同分母），题库级标记 allowUnreduced
 * - 交叉约分：构造"分子与对方分母各有公因数"的乘法式，只选约分后的式子不算乘积；
 *   干扰项 = 只约了一对（没约完）/ 约错数值
 * - 倒数快闪：真分数/整数/小数/带分数四形态，30% 负数；小数用常用锚点表（0.125~1.5）
 */

/** 通分快闪 */
const genCommonDenom: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  let d1: number, d2: number;
  if (rng() < 0.5) {
    const p = pick(rng, MULTIPLE_PAIRS);
    [d1, d2] = rng() < 0.5 ? p : [p[1], p[0]];
  } else {
    const p = pick(rng, COPRIME_PAIRS);
    [d1, d2] = rng() < 0.5 ? p : [p[1], p[0]];
  }
  const n1 = randomNumerator(rng, d1);
  const n2 = randomNumerator(rng, d2);
  const L = lcm(d1, d2);
  const prompt: MathExpr = { kind: 'op', op: '和', terms: [frac(n1, d1), frac(n2, d2)] };
  if (rng() < 0.6) {
    // 问其中一边通分后的样子；若某边分母已是 L 则固定问另一边（避免答案照抄题面）
    let askFirst = rng() < 0.5;
    if (askFirst && d1 === L) askFirst = false;
    if (!askFirst && d2 === L) askFirst = true;
    const qN = askFirst ? n1 : n2;
    const qD = askFirst ? d1 : d2;
    const oN = askFirst ? n2 : n1;
    const oD = askFirst ? d2 : d1;
    const cN = qN * (L / qD);
    const v = cN / L;
    const traps: Trap[] = [];
    pushTrap(traps, frac(oN * (L / oD), L), '那是另一个分数通分后的样子，看清问的是哪边', v);
    pushTrap(traps, frac(qN, L), '通分后分子也要乘同样的倍数', v);
    pushTrap(traps, frac(cN, qD), '分母要变成两个分母的公倍数', v);
    fillTraps(traps, cN, L);
    return makeQuestion(prompt, `把 ${qN}/${qD} 通分后变成哪个？`, frac(cN, L), traps);
  }
  // 问最小公分母
  const traps: Trap[] = [];
  pushTrap(traps, text(String(d1 * d2)), '可以更小：用两个分母的最小公倍数', L);
  pushTrap(traps, text(String(d1 + d2)), '公分母不是把分母相加', L);
  pushTrap(traps, text(String(L * 2)), '是公倍数但不是最小的', L);
  {
    const keys = new Set(traps.map((t) => exprKey(t.value)));
    for (const dt of [1, -1, 2, 4, -2]) {
      if (keys.size >= 4) break;
      if (L + dt <= 0) continue;
      const v2 = text(String(L + dt));
      if (keys.has(exprKey(v2))) continue;
      keys.add(exprKey(v2));
      traps.push({ value: v2, trap: '差一点点，再算一遍' });
    }
  }
  return makeQuestion(prompt, '通分用的最小公分母是？', text(String(L)), traps);
};

/** 交叉约分 */
const genCrossCancel: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  // 构造 n1/d1 × n2/d2：n1 与 d2 有公因数 a（约完 x/y），n2 与 d1 有公因数 b（约完 z/w）
  let n1 = 2, d1 = 4, n2 = 2, d2 = 6, x = 1, y = 3, z = 1, w = 2;
  for (let t = 0; t < 80; t++) {
    const a = pick(rng, [2, 3, 4, 5]);
    const b = pick(rng, [2, 3, 4, 5]);
    x = 1 + Math.floor(rng() * 3);
    y = 2 + Math.floor(rng() * 3);
    z = 1 + Math.floor(rng() * 3);
    w = 2 + Math.floor(rng() * 3);
    n1 = a * x;
    d2 = a * y;
    n2 = b * z;
    d1 = b * w;
    if (n1 < d1 && n2 < d2) break;
  }
  const [c1n, c1d] = reduce2(x, w);
  const [c2n, c2d] = reduce2(z, y);
  const promptExpr: MathExpr = { kind: 'op', op: '×', terms: [frac(n1, d1), frac(n2, d2)] };
  const pv = exprValue(promptExpr);
  const correct: MathExpr = { kind: 'op', op: '×', terms: [frac(c1n, c1d), frac(c2n, c2d)] };
  const traps: Trap[] = [];
  pushTrap(traps, { kind: 'op', op: '×', terms: [frac(c1n, c1d), frac(n2, d2)] }, '还没约完：右边的分子和左边的分母也能约', pv, true);
  pushTrap(traps, { kind: 'op', op: '×', terms: [frac(n1, d1), frac(c2n, c2d)] }, '还没约完：另一对也能约', pv, true);
  pushTrap(traps, { kind: 'op', op: '×', terms: [frac(c1n, c1d + 1), frac(c2n, c2d)] }, '约分后分母算错了', pv);
  pushTrap(traps, { kind: 'op', op: '×', terms: [frac(c1n + 1, c1d), frac(c2n, c2d)] }, '约分后分子算错了', pv);
  return makeQuestion(promptExpr, '先约分再乘，约分后的式子是哪个？', correct, traps);
};

/** 小数倒数锚点表：[小数文本, 倒数表达式] */
const RECIP_DECIMALS: [string, MathExpr][] = [
  ['0.5', text('2')], ['0.25', text('4')], ['0.2', text('5')], ['0.125', text('8')],
  ['0.4', frac(5, 2)], ['0.75', frac(4, 3)], ['1.5', frac(2, 3)], ['1.25', frac(4, 5)],
];

/** 倒数快闪 */
const genReciprocal: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const form = rng();
  const neg = rng() < 0.3;
  const s = neg ? '-' : '';
  if (form < 0.35) {
    // 真分数 → 假分数
    const d = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9]);
    const n = randomNumerator(rng, d);
    const traps: Trap[] = [
      { value: frac(s + n, d), trap: '忘倒了：分子分母要交换位置' },
      { value: frac(s + (d + 1), n), trap: '差一点点，再算一遍' },
      { value: frac(s + d, n + 1), trap: '差一点点，再算一遍' },
    ];
    return makeQuestion(frac(s + n, d), '写出它的倒数', frac(s + d, n), traps);
  }
  if (form < 0.6) {
    // 整数 → 单位分数
    const k = 2 + Math.floor(rng() * 11);
    const traps: Trap[] = [
      { value: text(s + k), trap: `整数的倒数是 1/${k}，不是它本身` },
      { value: text(s + '1'), trap: '倒数要倒过来，不是不变' },
      { value: frac(s + '2', k), trap: '分子是 1', },
    ];
    return makeQuestion(text(s + k), '写出它的倒数', frac(s + '1', k), traps);
  }
  if (form < 0.8) {
    // 小数 → 整数或分数（锚点表）
    const [dec, ans] = pick(rng, RECIP_DECIMALS);
    const av = exprValue(ans);
    const traps: Trap[] = [{ value: text(dec), trap: '忘倒了，这是原数' }];
    if (ans.kind === 'text') {
      traps.push({ value: text(String(Number(ans.text) + 1)), trap: '差一点点，再算一遍' });
      traps.push({ value: text(String(Math.max(1, Number(ans.text) - 1))), trap: '差一点点，再算一遍' });
    } else if (ans.kind === 'frac') {
      traps.push({ value: frac(ans.d, ans.n), trap: '倒的方向反了' });
      traps.push({ value: frac(Number(ans.n) + 1, ans.d), trap: '差一点点，再算一遍' });
    }
    if (neg) {
      // 负数小数：题面与答案加负号
      const negAns: MathExpr =
        ans.kind === 'text' ? text('-' + ans.text) : frac('-' + (ans as { n: string }).n, (ans as { d: string }).d);
      const negTraps = traps.map((t) => ({
        trap: t.trap,
        value: t.value.kind === 'text' ? text('-' + (t.value as { text: string }).text) : t.value,
      }));
      void av;
      return makeQuestion(text('-' + dec), '写出它的倒数', negAns, negTraps);
    }
    return makeQuestion(text(dec), '写出它的倒数', ans, traps);
  }
  // 带分数 → 假分数的倒数
  const w = 1 + Math.floor(rng() * 3);
  const d = pick(rng, [2, 3, 4, 5, 6, 8]);
  const n = randomNumerator(rng, d);
  const a = w * d + n;
  const traps: Trap[] = [
    { value: frac(s + d, n), trap: '带分数要先化成假分数再倒，不能只倒分数部分' },
    { value: frac(s + a, d), trap: '这是原数（假分数形式），还没倒' },
    { value: frac(s + (d + 1), a), trap: '差一点点，再算一遍' },
  ];
  return makeQuestion(mixed(Number(s + w), n, d), '写出它的倒数', frac(s + d, a), traps);
};

/* ---------------- 有理数 1.1/1.3 缺口：相反数绝对值 / 负数比大小 / 乘除符号 / 正负乘除 ---------------- */

/** 非零整数（±maxAbs 内，返回十分位整数） */
function intTenth(rng: () => number, maxAbs: number): number {
  const k = 1 + Math.floor(rng() * maxAbs);
  return (rng() < 0.5 ? -1 : 1) * k * 10;
}

/** 相反数与绝对值快闪 */
const genOppositeAbs: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const v = signedTenth(rng, rng() < 0.25);
  const V = Math.abs(v);
  const variant = rng();
  let promptText: string, requirement: string, r: number, hint: string;
  if (variant < 0.3) {
    promptText = fmtTenth(v);
    requirement = '写出它的相反数';
    r = -v;
    hint = '相反数就是符号反过来';
  } else if (variant < 0.55) {
    promptText = `-(${fmtTenth(v)})`;
    requirement = '化简';
    r = -v;
    hint = '括号前是负号，去掉括号要变号';
  } else if (variant < 0.8) {
    promptText = `|${fmtTenth(v)}|`;
    requirement = '化简';
    r = V;
    hint = '绝对值是非负的';
  } else {
    promptText = `-|${fmtTenth(v)}|`;
    requirement = '化简';
    r = -V;
    hint = '负号在绝对值外面，结果是负的';
  }
  const traps: Trap[] = [];
  pushTextTrap(traps, -r, hint, r);
  pushTextTrap(traps, v, '这是原数，再想想规则', r);
  fillTextTraps(traps, r);
  return makeQuestion(text(promptText), requirement, text(fmtTenth(r)), traps);
};

/** 正负数比大小：只同形态（整数 vs 整数、一位小数 vs 一位小数），不跨形态（避免混入 A1） */
const genSignCompare: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const sameT = text('一样大');
  if (rng() < 0.1) {
    // 等值不同写法：-3 vs -3.0（不需要转换能力，纯读数）
    const iv = Math.floor(rng() * 15) - 7 || 1;
    const left = text(String(iv));
    const right = text(`${iv}.0`);
    const traps: Trap[] = [
      { value: left, trap: '两边其实相等：3 和 3.0 一样大' },
      { value: right, trap: '两边其实相等：3 和 3.0 一样大' },
    ];
    return makeQuestion({ kind: 'vs', left, right }, '哪边更大？', sameT, traps);
  }
  const decimal = rng() < 0.3;
  let v1 = signedTenth(rng, decimal);
  let v2 = signedTenth(rng, decimal);
  for (let t = 0; t < 60 && (v1 === v2 || Math.abs(v1 - v2) > 60); t++) v2 = signedTenth(rng, decimal);
  const left = text(fmtTenth(v1));
  const right = text(fmtTenth(v2));
  const bigger = v1 > v2 ? left : right;
  const smaller = v1 > v2 ? right : left;
  const hasNeg = v1 < 0 || v2 < 0;
  const traps: Trap[] = [
    { value: smaller, trap: hasNeg ? '负数比较：绝对值大的反而小' : '这个更小，再仔细比' },
    { value: sameT, trap: '两边不相等，再仔细比' },
  ];
  return makeQuestion({ kind: 'vs', left, right }, '哪边更大？', bigger, traps);
};

/** 乘除符号快闪：数负因数个数判正负（偶正奇负），固定 3 选项 */
const genSignFlashMul: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const cnt = 2 + Math.floor(rng() * 3); // 2~4 项
  const terms = Array.from({ length: cnt }, () => intTenth(rng, 9));
  const op = rng() < 0.7 ? '×' : '÷';
  const negCount = terms.filter((t) => t < 0).length;
  const isPos = negCount % 2 === 0;
  const pos = text('正数');
  const neg = text('负数');
  const zero = text('等于 0');
  const hint = '数负数的个数：偶数个得正，奇数个得负';
  const correct = isPos ? pos : neg;
  const traps: Trap[] = [pos, neg, zero]
    .filter((x) => exprKey(x) !== exprKey(correct))
    .map((x) => ({
      value: x,
      trap: exprKey(x) === '等于 0' ? '没有 0 因数，结果不会是 0' : hint,
    }));
  return makeQuestion(
    { kind: 'op', op, terms: terms.map((t) => text(fmtTenth(t))) },
    '不计算，判断结果是正还是负',
    correct,
    traps,
  );
};

/** 正负数乘除：组合检验场（符号规则 + 表内乘除）；除法先定商和除数反推被除数保证整除 */
const genSignedMulDiv: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.55) {
    // 乘法：整数 ±9 或 一位小数 × 整数
    const decimal = rng() < 0.25;
    const a = decimal ? signedTenth(rng, true) : intTenth(rng, 9);
    const b = intTenth(rng, 9);
    const r = (a * b) / 10;
    const traps: Trap[] = [];
    pushTextTrap(traps, -r, '符号规则：同号得正，异号得负', r);
    pushTextTrap(traps, r + b, '积算错了，再算一遍', r);
    pushTextTrap(traps, r - b, '积算错了，再算一遍', r);
    fillTextTraps(traps, r);
    return makeQuestion(
      { kind: 'op', op: '×', terms: [text(fmtTenth(a)), text(fmtTenth(b))] },
      '计算（注意正负号）',
      text(fmtTenth(r)),
      traps,
    );
  }
  // 除法：被除数 = 除数 × 商（整数域保证整除）
  const b = intTenth(rng, 9);
  const q = intTenth(rng, 9);
  const dividend = (b * q) / 10;
  const traps: Trap[] = [];
  pushTextTrap(traps, -q, '符号规则：同号得正，异号得负', q);
  pushTextTrap(traps, q + b, '商算错了，再算一遍', q);
  pushTextTrap(traps, q - b, '商算错了，再算一遍', q);
  fillTextTraps(traps, q);
  return makeQuestion(
    { kind: 'op', op: '÷', terms: [text(fmtTenth(dividend)), text(fmtTenth(b))] },
    '计算（注意正负号）',
    text(fmtTenth(q)),
    traps,
  );
};

const lcdSkill: Skill = {
  id: 'g6-sense-lcd',
  title: '通分快闪',
  intro: [
    '考核点：通分（异分母加减的地基，原子能力 C2）',
    '两种问法：把某一边通分后变成哪个（60%）/ 最小公分母是几（40%）',
    '通分答案不约分——就是要同分母！本题库不考加减计算',
    '倍数关系分母 50% + 互质分母 50%',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  allowUnreduced: true,
  generators: [genCommonDenom],
};

const crossCancelSkill: Skill = {
  id: 'g6-sense-crosscancel',
  title: '交叉约分',
  intro: [
    '考核点：乘法前先约分（分数乘法的速算地基）',
    '给出乘法式，选出约分后的式子——只约分，不算乘积',
    '技巧：一个数的分子和另一个数的分母可以互相约',
    '小心"还没约完"的选项（只约了一对）',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  supportsReview: false,
  generators: [genCrossCancel],
};

const reciprocalSkill: Skill = {
  id: 'g6-sense-reciprocal',
  title: '倒数快闪',
  intro: [
    '考核点：秒答倒数（除法变乘法的开关，原子能力 C4）',
    '四种形态：真分数 / 整数 / 小数 / 带分数，30% 是负数',
    '整数 k 的倒数是 1/k；带分数先化假分数再倒；负数的倒数还是负数',
    '小数记锚点：0.5↔2、0.25↔4、0.125↔8',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  hideMixedKey: true,
  generators: [genReciprocal],
};

const oppositeAbsSkill: Skill = {
  id: 'g6-sign-opposite',
  title: '相反数与绝对值',
  intro: [
    '考核点：相反数、去括号、绝对值化简（教材 1.1，原子能力 B2）',
    '四种问法：写相反数 / -(-3) 化简 / |−5| 化简 / -|−5| 化简',
    '规则：负负得正；绝对值是非负的；负号在绝对值外面结果还是负',
    '整数 75% + 一位小数 25%',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genOppositeAbs],
};

const signCompareSkill: Skill = {
  id: 'g6-sign-compare',
  title: '正负数比大小',
  intro: [
    '考核点：含负数的大小比较（教材 1.1，原子能力 B2）',
    '只出同形态比较：整数 vs 整数、一位小数 vs 一位小数',
    '核心直觉：负数比较，绝对值大的反而小（-5 < -3）',
    '一成题目两边相等（-3 和 -3.0 一样大）',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignCompare],
};

const signFlashMulSkill: Skill = {
  id: 'g6-sign-flash-mul',
  title: '乘除符号快闪',
  intro: [
    '考核点：不计算，判断乘除结果的正负（教材 1.3 符号规则）',
    '口诀：数负数的个数——偶数个得正，奇数个得负',
    '2~4 个数连乘或连除，"等于 0"永远是干扰项（没有 0 因数）',
    '限时很短，凭直觉秒杀！本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 5,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignFlashMul],
};

const signedMulSkill: Skill = {
  id: 'g6-signed-mul',
  title: '正负数乘除',
  intro: [
    '考核点：正负数乘除速算（教材 1.3，组合检验场）',
    '乘法 55%（整数 ±9 内，25% 一位小数×整数）+ 除法 45%（保证整除）',
    '先定符号（同号得正、异号得负），再算绝对值',
    '复习模式键盘有负号键，负数答案先按 − 再输数字',
  ],
  timeLimitSec: 12,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genSignedMulDiv],
};

/* ---------------- 有理数 1.4/1.5 + 巧算：乘方速记 / 分数小数混合 / 运算顺序 / 凑整巧算 ---------------- */

/** 乘方速记：平方 11²~20²（40%）+ 立方 2³~6³（25%）+ (-a)² vs -a² 符号陷阱（35%） */
const genPowerFlash: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.4) {
    const n = 11 + Math.floor(rng() * 10);
    const v = n * n;
    const traps: Trap[] = [];
    pushTextTrap(traps, n * 20, '平方是 n×n，不是 n×2', v * 10);
    pushTextTrap(traps, (n - 1) * (n - 1) * 10, '记岔了：这是相邻的平方数', v * 10);
    pushTextTrap(traps, (n + 1) * (n + 1) * 10, '记岔了：这是相邻的平方数', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${n}²`), '秒答', text(String(v)), traps);
  }
  if (kind < 0.65) {
    const n = 2 + Math.floor(rng() * 5);
    const v = n * n * n;
    const traps: Trap[] = [];
    pushTextTrap(traps, n * 30, '立方是 n×n×n，不是 n×3', v * 10);
    pushTextTrap(traps, n * n * 10, '这是平方，立方要再乘一个 n', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${n}³`), '秒答', text(String(v)), traps);
  }
  // 符号陷阱：负号在不在括号里，结果天差地别
  const sq = rng() < 0.65;
  const a = sq ? 2 + Math.floor(rng() * 8) : 2 + Math.floor(rng() * 3);
  const inParens = rng() < 0.5;
  if (sq) {
    const v = inParens ? a * a : -a * a;
    const traps: Trap[] = [];
    pushTextTrap(traps, -v * 10, inParens ? '负数的平方是正数' : '负号在平方外面：先算平方再添负号', v * 10);
    pushTextTrap(traps, (inParens ? a * 2 : -a * 2) * 10, '平方是 a×a，不是 a×2', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(inParens ? `(-${a})²` : `-${a}²`), '计算（看清负号位置）', text(String(v)), traps);
  }
  const v = -a * a * a;
  const traps: Trap[] = [];
  pushTextTrap(traps, -v * 10, '负数的立方还是负数（三个负号）', v * 10);
  pushTextTrap(traps, a * 30, '立方是 a×a×a，不是 a×3', v * 10);
  fillTextTraps(traps, v * 10);
  return makeQuestion(text(`(-${a})³`), '计算（看清符号）', text(String(v)), traps);
};

/* ---- 分数+小数混合四则：有理数精确计算（分子/分母对），答案择优呈现（整数/小数 > 带分数 > 分数） ---- */

/** 约分 */
const red = (n: number, d: number): [number, number] => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return [n / g, d / g];
};
const rAdd = (x: [number, number], y: [number, number]): [number, number] => red(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const rSub = (x: [number, number], y: [number, number]): [number, number] => red(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const rMul = (x: [number, number], y: [number, number]): [number, number] => red(x[0] * y[0], x[1] * y[1]);
const rDiv = (x: [number, number], y: [number, number]): [number, number] => red(x[0] * y[1], x[1] * y[0]);
const rVal = (x: [number, number]): number => x[0] / x[1];

/** 分母只含因数 2/5 → 可写成有限小数 */
const isDecDenom = (d: number): boolean => {
  let x = d;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  return x === 1;
};

/** 有理数的最佳显示形态：整数/有限小数 → 文本；>1 的非小数 → 带分数；其余 → 分数 */
function fmtRat(x: [number, number]): MathExpr {
  const [n, d] = red(x[0], x[1]);
  if (n === 0) return text('0');
  if (d === 1) return text(String(n));
  if (isDecDenom(d)) return text(String(parseFloat((n / d).toFixed(6))));
  if (n > d) return mixed(Math.floor(n / d), n % d, d);
  return frac(n, d);
}

/** 小数锚点表：[小数文本, 分子, 分母]——分数+小数混合题的小数都来自这张表（转换是已训练的原子能力） */
const DEC_ANCHORS: [string, number, number][] = [
  ['0.5', 1, 2], ['0.25', 1, 4], ['0.2', 1, 5], ['0.125', 1, 8], ['0.75', 3, 4],
  ['0.4', 2, 5], ['0.6', 3, 5], ['1.5', 3, 2], ['1.25', 5, 4], ['2.5', 5, 2],
];

/** 常见转换误区：小数记错的对应分数 */
const WRONG_ANCHOR: Record<string, [number, number]> = {
  '0.25': [1, 5], '0.2': [1, 4], '0.125': [1, 4], '0.5': [1, 4],
  '0.75': [3, 5], '0.4': [1, 4], '0.6': [3, 4], '1.25': [3, 2],
};

/** 分数+小数混合四则：加/减/乘/除各 25%，两项为主；减法保证结果为正 */
const genFracDecMix: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const [decS, dn, dd] = pick(rng, DEC_ANCHORS);
  const b = pick(rng, [2, 3, 4, 5, 6, 8, 9]);
  const an = randomNumerator(rng, b);
  const F: [number, number] = [an, b];
  const D: [number, number] = [dn, dd];
  let op = pick(rng, ['+', '-', '×', '÷'] as const);
  let terms: MathExpr[];
  let res: [number, number];
  let swapped = false;
  if (op === '-' && Math.abs(rVal(F) - rVal(D)) < 1e-9) op = '+'; // 相等相减得 0 没意义，改加法
  if (op === '+') {
    terms = [frac(an, b), text(decS)];
    res = rAdd(F, D);
  } else if (op === '×') {
    terms = [frac(an, b), text(decS)];
    res = rMul(F, D);
  } else if (op === '-') {
    if (rVal(F) >= rVal(D)) {
      terms = [frac(an, b), text(decS)];
      res = rSub(F, D);
    } else {
      terms = [text(decS), frac(an, b)];
      res = rSub(D, F);
      swapped = true;
    }
  } else {
    if (rng() < 0.5) {
      terms = [frac(an, b), text(decS)];
      res = rDiv(F, D);
    } else {
      terms = [text(decS), frac(an, b)];
      res = rDiv(D, F);
      swapped = true;
    }
  }
  const ans = fmtRat(res);
  const ansKey = exprKey(ans);
  const traps: Trap[] = [];
  const seen = new Set<string>([ansKey]);
  const pushRat = (x: [number, number], trap: string) => {
    if (x[0] <= 0) return;
    const t = fmtRat(x);
    const k = exprKey(t);
    if (seen.has(k)) return;
    seen.add(k);
    traps.push({ value: t, trap });
  };
  // 误区 1：除法/减法方向反了
  if (op === '÷') pushRat(swapped ? rDiv(F, D) : rDiv(D, F), '被除数和除数的位置要看清');
  if (op === '-') pushRat(swapped ? rSub(F, D) : rSub(D, F), '谁减谁要看清（本题结果为正）');
  // 误区 2：小数转换记错（0.25 当成 1/5 之类）
  const wa = WRONG_ANCHOR[decS];
  if (wa) {
    const W: [number, number] = wa;
    const wrongRes = op === '+' ? rAdd(F, W) : op === '×' ? rMul(F, W) : op === '-' ? rSub(F, W) : rDiv(F, W);
    pushRat(wrongRes, `小数转分数记错了：${decS} 不是 ${wa[0]}/${wa[1]}`);
  }
  // 误区 3：运算符号看错（换一种运算的结果）
  {
    const altOp = pick(rng, (['+', '-', '×', '÷'] as const).filter((o) => o !== op));
    const alt =
      altOp === '+' ? rAdd(F, D) : altOp === '×' ? rMul(F, D) : altOp === '-' ? rSub(F, D) : rDiv(F, D);
    pushRat(alt, `这是按 ${altOp} 算的，看清运算符号`);
  }
  // 兜底：邻值（分子 ±1、分母 ±1、分子翻倍；整数答案给整数邻值）
  for (const [nn, dd2] of [
    [res[0] + 1, res[1]], [res[0] - 1, res[1]], [res[0], res[1] + 1],
    [res[0] * 2, res[1]], [res[0] + 2, res[1]],
  ] as [number, number][]) {
    if (traps.length >= 3) break;
    if (nn <= 0 || dd2 < 1) continue;
    pushRat([nn, dd2], '差一点点，再仔细算一遍');
  }
  return makeQuestion(
    { kind: 'op', op, terms },
    '计算（结果约到最简，假分数或带分数均可）',
    ans,
    traps,
  );
};

/** 运算顺序：只问"先算哪一步"，不计算（原子能力：先乘除后加减 + 括号优先 + 同级从左到右） */
const genOpOrder: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  // 4 个互不相同的数，保证各"步骤对"文本不重复
  const nums = new Set<number>();
  while (nums.size < 4) nums.add(2 + Math.floor(rng() * 14));
  const [A, B, C, D] = [...nums];
  const form = Math.floor(rng() * 6);
  let expr: string, step: string;
  let traps: Trap[];
  if (form === 0) {
    expr = `${A} + ${B} × ${C}`;
    step = `${B} × ${C}`;
    traps = [
      { value: text(`${A} + ${B}`), trap: '先乘除后加减：乘法是 B 和 C 之间的' },
      { value: text(`${A} + ${C}`), trap: '乱配了：乘法在中间的 B 和 C 之间' },
      { value: text(`${B} + ${C}`), trap: '符号看错了，中间是乘号' },
    ];
  } else if (form === 1) {
    expr = `${A} - ${B} ÷ ${C}`;
    step = `${B} ÷ ${C}`;
    traps = [
      { value: text(`${A} - ${B}`), trap: '先乘除后加减：除法是 B 和 C 之间的' },
      { value: text(`${A} ÷ ${C}`), trap: '乱配了：除法在 B 和 C 之间' },
      { value: text(`${B} - ${C}`), trap: '符号看错了，中间是除号' },
    ];
  } else if (form === 2) {
    expr = `(${A} + ${B}) × ${C}`;
    step = `${A} + ${B}`;
    traps = [
      { value: text(`${B} × ${C}`), trap: '括号里的要最先算' },
      { value: text(`${A} × ${C}`), trap: '乱配了：括号优先' },
      { value: text(`${B} + ${C}`), trap: '括号优先，先算括号里面' },
    ];
  } else if (form === 3) {
    expr = `${A} × (${B} - ${C})`;
    step = `${B} - ${C}`;
    traps = [
      { value: text(`${A} × ${B}`), trap: '括号里的要最先算' },
      { value: text(`${A} - ${C}`), trap: '乱配了：括号优先' },
      { value: text(`${B} × ${C}`), trap: '符号看错了，括号里是减号' },
    ];
  } else if (form === 4) {
    expr = `${A} ÷ ${B} × ${C}`;
    step = `${A} ÷ ${B}`;
    traps = [
      { value: text(`${B} × ${C}`), trap: '乘除同级要从左往右算' },
      { value: text(`${A} × ${C}`), trap: '乱配了：同级从左往右' },
      { value: text(`${A} ÷ ${C}`), trap: '乱配了：同级从左往右' },
    ];
  } else {
    expr = `${A} + ${B} - ${C} + ${D}`;
    step = `${A} + ${B}`;
    traps = [
      { value: text(`${B} - ${C}`), trap: '加减同级要从左往右，第一步在最左边' },
      { value: text(`${C} + ${D}`), trap: '加减同级要从左往右，第一步在最左边' },
      { value: text(`${A} + ${C}`), trap: '乱配了：同级从左往右' },
    ];
  }
  return makeQuestion(text(expr), '先算哪一步？', text(step), traps);
};

/** 凑整巧算：40% 选最聪明的第一步（乘法凑整对），60% 凑整求值（乘法倍数对 / 99·101 调整 / 小数凑整 / 198 补整） */
const genOpLaws: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.4) {
    const PAIRS: [string, string][] = [
      ['0.25', '4'], ['2.5', '4'], ['0.125', '8'], ['25', '4'], ['125', '8'], ['0.5', '2'],
    ];
    const [xs, ys] = pick(rng, PAIRS);
    // 中间乘数不能和凑整对撞车（否则干扰项和正确答案重复）
    const banned = new Set([parseFloat(xs), parseFloat(ys)]);
    let a = 3 + Math.floor(rng() * 30);
    for (let t = 0; t < 40 && banned.has(a); t++) a = 3 + Math.floor(rng() * 30);
    if (banned.has(a)) a = 33;
    const traps: Trap[] = [
      { value: text(`${xs} × ${a}`), trap: '按顺序硬算第一步，慢还容易错' },
      { value: text(`${a} × ${ys}`), trap: '这一步凑不出整：找乘起来是整十整百的两个数' },
      { value: text(`${xs} + ${ys}`), trap: '是连乘不是加法' },
    ];
    return makeQuestion(
      text(`${xs} × ${a} × ${ys}`),
      '怎么算最快？第一步选哪个',
      text(`${xs} × ${ys}`),
      traps,
    );
  }
  const t = rng();
  if (t < 0.2) {
    const k = 3 + Math.floor(rng() * 10);
    const v = 100 * k;
    const traps: Trap[] = [];
    pushTextTrap(traps, 100 * (k - 1) * 10, '少数了一组 25×4=100', v * 10);
    pushTextTrap(traps, 100 * (k + 1) * 10, '多数了一组 25×4=100', v * 10);
    pushTextTrap(traps, (v - 50) * 10, '把 32 拆成 4×8 再算：25×4=100', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`25 × ${4 * k}`), '计算（凑整最快）', text(String(v)), traps);
  }
  if (t < 0.4) {
    const k = 2 + Math.floor(rng() * 5);
    const v = 1000 * k;
    const traps: Trap[] = [];
    pushTextTrap(traps, 1000 * (k - 1) * 10, '少数了一组 125×8=1000', v * 10);
    pushTextTrap(traps, 1000 * (k + 1) * 10, '多数了一组 125×8=1000', v * 10);
    pushTextTrap(traps, (v - 500) * 10, '把乘数拆出 8：125×8=1000', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`125 × ${8 * k}`), '计算（凑整最快）', text(String(v)), traps);
  }
  if (t < 0.65) {
    const near100 = rng() < 0.5 ? 99 : 101;
    const m = 3 + Math.floor(rng() * 7);
    const v = near100 * m;
    const traps: Trap[] = [];
    pushTextTrap(traps, 100 * m * 10, near100 === 99 ? '99×m = 100×m − m，还要减一个 m' : '101×m = 100×m + m，还要加一个 m', v * 10);
    pushTextTrap(traps, (near100 === 99 ? 98 * m : 102 * m) * 10, near100 === 99 ? '多减了一个 m' : '多加了一个 m', v * 10);
    pushTextTrap(traps, 90 * m * 10, '把接近 100 的数当 100 算再调整', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${near100} × ${m}`), '计算（凑整最快）', text(String(v)), traps);
  }
  if (t < 0.85) {
    // 小数凑整加法：a + b + c，其中 a + c 凑整
    const PAIRS: [number, number][] = [[46, 54], [88, 12], [125, 75], [37, 63], [99, 1], [25, 75]];
    const [x, z] = pick(rng, PAIRS);
    const y = 11 + Math.floor(rng() * 88); // 1.1~9.8
    const v = x + y + z; // 十分位整数
    const traps: Trap[] = [];
    pushTextTrap(traps, v - 10, '小数点对齐错，差 1', v);
    pushTextTrap(traps, v + 10, '小数点对齐错，差 1', v);
    pushTextTrap(traps, x + z + y - 2, '进位算错了', v);
    fillTextTraps(traps, v);
    return makeQuestion(
      text(`${fmtTenth(x)} + ${fmtTenth(y)} + ${fmtTenth(z)}`),
      '计算（先找能凑整的两个数）',
      text(fmtTenth(v)),
      traps,
    );
  }
  // 198 补整加法：把 198 当 200 加，再减 2
  const base = pick(rng, [198, 298, 397, 495, 599, 697]);
  const gap = base % 100 === 99 || base % 100 === 95 ? 100 - (base % 100) : base % 100 === 97 ? 3 : 100 - (base % 100);
  const round = base + gap; // 最近的整百
  const m = 20 + Math.floor(rng() * 70);
  const v = base + m;
  const traps: Trap[] = [];
  pushTextTrap(traps, (round + m) * 10, `把 ${base} 当 ${round} 加了，别忘了再减 ${gap}`, v * 10);
  pushTextTrap(traps, (round + m - 2 * gap) * 10, '调整方向反了', v * 10);
  pushTextTrap(traps, (v + 10) * 10, '十位进位算错了', v * 10);
  fillTextTraps(traps, v * 10);
  return makeQuestion(text(`${base} + ${m}`), '计算（凑整最快）', text(String(v)), traps);
};

const powerFlashSkill: Skill = {
  id: 'g6-power-flash',
  title: '乘方速记',
  intro: [
    '考核点：平方/立方秒答 + 负号位置辨析（教材 1.4）',
    '平方 11²~20²（40%）、立方 2³~6³（25%）',
    '符号陷阱 35%：(-3)² = 9 但 -3² = -9，负号在括号外先算平方！',
    '复习模式键盘有负号键',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genPowerFlash],
};

const fracDecMixSkill: Skill = {
  id: 'g6-frac-dec-mix',
  title: '分数小数混合算',
  intro: [
    '考核点：分数与小数的混合四则（教材 1.5，组合检验场）',
    '加/减/乘/除各 25%，两项计算；小数全部来自锚点表（0.125~2.5）',
    '答案自动选最好看的形态：能写小数写小数，否则最简分数/带分数',
    '减法保证结果为正；小心"方向反了"和"0.25 记成 1/5"的干扰项',
  ],
  timeLimitSec: 18,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracDecMix],
};

const opOrderSkill: Skill = {
  id: 'g6-op-order',
  title: '运算顺序',
  intro: [
    '考核点：只判断"先算哪一步"，不计算（教材 1.5）',
    '三条规则：括号优先 → 先乘除后加减 → 同级从左往右',
    '干扰项都是"看起来顺手"的错误第一步',
    '本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 8,
  questionCount: 10,
  supportsReview: false,
  generators: [genOpOrder],
};

const opLawsSkill: Skill = {
  id: 'g6-op-laws',
  title: '凑整巧算',
  intro: [
    '考核点：选最聪明的算法，不硬算（运算律运用）',
    '40% 选第一步：连乘里找乘起来是整十整百的两个数（0.25×4、125×8）',
    '60% 凑整求值：25×32、99×7、4.6+5.7+5.4、198+76',
    '本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  supportsReview: false,
  generators: [genOpLaws],
};

/* ---------------- 年级树（2024 沪教版五四制归类：原子能力归最早系统学习的年级） ---------------- */

export const GRADES: Grade[] = [
  {
    id: 'g5',
    title: '五年级 · 分数与小数',
    available: true,
    units: [
      { id: 'g5-frac-meaning', title: '5.1 分数的意义与改写', skills: [rewriteSkill] },
      { id: 'g5-frac-simplify', title: '5.2 约分', skills: [simplifySkill] },
      { id: 'g5-frac-lcd', title: '5.3 通分', skills: [lcdSkill] },
      { id: 'g5-frac-compare', title: '5.4 分数的大小比较', skills: [compareSkill] },
      { id: 'g5-frac-addsub', title: '5.5 分数的加减法', skills: [fracAddSkill, fracSubSkill] },
      { id: 'g5-frac-mul', title: '5.6 分数的乘法', skills: [fracMulSkill, crossCancelSkill] },
      { id: 'g5-frac-div', title: '5.7 分数的除法', skills: [reciprocalSkill, fracDivSkill] },
      { id: 'g5-frac-dec', title: '5.8 分数与小数', skills: [rationalConvertSkill, fracDecMixSkill] },
    ],
  },
  {
    id: 'g6',
    title: '六年级上 · 第1章 有理数',
    available: true,
    units: [
      { id: 'g6-1-1', title: '1.1 有理数的引入', skills: [oppositeAbsSkill, signCompareSkill] },
      { id: 'g6-1-2', title: '1.2 有理数的加法与减法', skills: [signFlashSkill, signedAddSkill] },
      { id: 'g6-1-3', title: '1.3 有理数的乘法与除法', skills: [signFlashMulSkill, signedMulSkill] },
      { id: 'g6-1-4', title: '1.4 有理数的乘方', skills: [powerFlashSkill] },
      { id: 'g6-1-5', title: '1.5 有理数的混合运算', skills: [opOrderSkill, opLawsSkill] },
    ],
  },
  {
    id: 'g6b',
    title: '六年级下',
    available: true,
    units: [{ id: 'g6b-5-2', title: '5.2 百分数', skills: [] }],
  },
  { id: 'g7', title: '七年级', available: false, units: [] },
  { id: 'g8', title: '八年级', available: false, units: [] },
  { id: 'g9', title: '九年级', available: false, units: [] },
];

export function findSkill(skillId: string): Skill | undefined {
  for (const g of GRADES)
    for (const u of g.units)
      for (const s of u.skills) if (s.id === skillId) return s;
  return undefined;
}

/** 一局题目的生成：均匀混合所有题型，种子可复现；count 可覆盖题量（复习模式 20 题） */
export function generateQuiz(skill: Skill, seed = Date.now(), count?: number): Question[] {
  const rng = mulberry32(seed);
  const total = count ?? skill.questionCount;
  return Array.from({ length: total }, (_, i) =>
    skill.generators[i % skill.generators.length](rng),
  );
}
