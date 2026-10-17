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

/** 改写用的分母与随机参数：分母池 {2~10, 12}（2026-10-14 教材对标扩充，原 2/3/4/5/6/8），
 *  整数部分 1~9（原 1~6），余数与分母互质 */
const REWRITE_DENOMINATORS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
function randomRewriteParams(rng: () => number) {
  const d = pick(rng, REWRITE_DENOMINATORS);
  const r = randomNumerator(rng, d);
  const w = 1 + Math.floor(rng() * 9);
  return { d, r, w, n: w * d + r };
}

/** A2-a 分数改写：假分数 → 带分数（如 7/6 = 1⅙），约 10% 为整除特例（如 12/4 = 3）
 *  干扰项误区池：余数看错 / 商大 1 / 商小 1 / 漏整数部分 / 颠倒成真分数 / 商余写反 */
const genImproperToMixed: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  // 整除特例（教材要求掌握"假分数化整数"形态）：分子刚好是分母的倍数
  if (rng() < 0.1) {
    const traps: Trap[] = [
      { value: text(String(w + 1)), trap: '商算大了，分一分数里面有几个分母' },
      { value: mixed(w, 1, d), trap: '正好整除，没有余数，答案直接写整数' },
      { value: frac(d, w * d), trap: '分子分母写反了，假分数的值大于 1' },
    ];
    if (w >= 2) traps.push({ value: text(String(w - 1)), trap: '商算小了，剩下的部分还够再分一份' });
    return makeQuestion(frac(w * d, d), '化成整数或带分数', text(String(w)), traps);
  }
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
  if (w < d)
    traps.push({ value: mixed(r, w, d), trap: '商和余数写反了：商是整数部分、余数才是分子' });
  return makeQuestion(frac(n, d), '用带分数表示', mixed(w, r, d), traps);
};

/** A2-b 分数改写：带分数 → 假分数（如 2⅓ = 7/3）
 *  干扰项误区池：整数+分子直接相加 / 忘记加分子 / 分子算错 / 漏整数部分 / 商大 1 */
const genMixedToImproper: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  const traps: Trap[] = [
    { value: frac(w + r, d), trap: '整数部分要先乘分母再加分子，不是直接相加' },
    { value: frac(w * d, d), trap: '整数 × 分母之后，还要加上原来的分子' },
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
  // 2026-10-02 扩池：倍数 7 → 12 种、分母加 10，不同题面 144 → 226
  const MULTIPLIERS = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 25];
  let n = 1, d = 2, k = 4;
  for (let tries = 0; tries < 50; tries++) {
    const td = pick(rng, [3, 4, 5, 6, 7, 8, 9, 10]);
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

/* ---------------- 六年级 · 有理数：负分数（分数线 × 负号线交叉，2026-10-17 新增） ----------------
 * 女儿实测最薄弱点：分数的正负数加减。诊断：五年级分数线全正数（减法重抽保证结果为正），
 * 六年级负号线只有整数/一位小数，两条线从未交叉。本区补 4 个技能：
 * - 负分数比大小（1.1，三选一）：负vs负 40%（同分子/同分母各半）/ 负分数vs负小数 25% / 正vs负 20% / 等值变形 15%
 * - 分数符号快闪（1.2，三选一）：相反数得 0 12%；其余同分母带符号相加 / 异分母正数相减各半
 * - 分数正负加减·基础（1.2）：同分母带符号 45% + 倍数分母 30% + 不够减（结果为负）25%
 * - 分数正负混合·进阶（1.2）：互质异号相加 40% + 减负数 30% + 小数分数混合 20% + 三项代数和 10%
 * 负分数一律用 frac('-n','d')（负号在分子里）表示，渲染层把负号前置到分数线左边并标红。
 * id 统一用 g6-signed-frac- 前缀，避开 validate.ts 中 g6-frac- 前缀的运算题校验。
 */

/** 带符号运算结果 → MathExpr：整数 → text；其余 → 最简分数（负号在分子）；不产生带分数 */
function sAnsExpr(n: number, d: number): MathExpr {
  const [rn, rd] = reduce2(n, d);
  if (rn % rd === 0) return text(String(rn / rd));
  return frac(rn, rd);
}

/** 需要"两个不同分子"的同分母分支专用分母表：剔除 2（最简分子只有 1 个，抽不出两个） */
const SIGNED_PAIR_DENOMS = [3, 4, 5, 6, 8];

/** 带符号形态陷阱：可约分时出"未约分等价"（数值故意相等）。gcd 对负 N 失效（返回负），用绝对值判断 */
function sFormTraps(traps: Trap[], N: number, D: number) {
  if (gcd(Math.abs(N), Math.abs(D)) > 1)
    traps.push({ value: frac(N, D), trap: '数值相等但没有约成最简，还要继续约分' });
}

/** 负分数比大小（三选一 vs 题）：负vs负 40%（同分子/同分母各半）/ 负分数vs负小数 25% / 正vs负 20% / 等值变形 15% */
const genSignedFracCmp: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const sameT = text('一样大');
  const r0 = rng();
  if (r0 < 0.15) {
    // 等值变形：-1/2 vs -0.5（小数转换是已训练的原子能力，这里考"负号不改变相等关系"）
    const d = pick(rng, DECIMAL_OK);
    const n = randomNumerator(rng, d);
    const f = frac(-n, d);
    const t = text(`-${fracToDecimalText(n, d)}`);
    const traps: Trap[] = [
      { value: f, trap: '两边其实相等：1/2 就是 0.5，负号不改变大小关系' },
      { value: t, trap: '两边其实相等：1/2 就是 0.5，负号不改变大小关系' },
    ];
    return makeQuestion({ kind: 'vs', left: f, right: t }, '哪边更大？', sameT, traps);
  }
  if (r0 < 0.55) {
    // 负 vs 负：同分子（分母大的反而小）/ 同分母（分子大的反而小）各半
    let n1: number, n2: number, d1: number, d2: number;
    if (rng() < 0.5) {
      d1 = pick(rng, ARITH_DENOMS);
      d2 = pick(rng, ARITH_DENOMS);
      for (let t = 0; t < 60 && d2 === d1; t++) d2 = pick(rng, ARITH_DENOMS);
      const lo = Math.min(d1, d2);
      const cands = coprimeNumerators(lo).filter((n) => gcd(n, d1) === 1 && gcd(n, d2) === 1);
      n1 = n2 = pick(rng, cands);
    } else {
      d1 = d2 = pick(rng, SIGNED_PAIR_DENOMS);
      n1 = randomNumerator(rng, d1);
      n2 = randomNumerator(rng, d1, n1);
    }
    const left = frac(-n1, d1);
    const right = frac(-n2, d2);
    const leftBigger = -n1 / d1 > -n2 / d2;
    const bigger = leftBigger ? left : right;
    const smaller = leftBigger ? right : left;
    const traps: Trap[] = [
      { value: smaller, trap: '负数比较：绝对值大的反而小' },
      { value: sameT, trap: '两边不相等，再仔细比' },
    ];
    return makeQuestion({ kind: 'vs', left, right }, '哪边更大？', bigger, traps);
  }
  if (r0 < 0.8) {
    // 负分数 vs 负小数：值接近但不同（差 0.05~0.2），必须先统一形态再比
    const d = pick(rng, DECIMAL_OK);
    const n = randomNumerator(rng, d);
    const fMilli = n * (1000 / d);
    const delta = pick(rng, [50, 100, 150, 200]);
    const up = rng() < 0.5;
    const gMilli = up ? Math.min(950, fMilli + delta) : Math.max(50, fMilli - delta);
    const f = frac(-n, d);
    const t = text(`-${fracToDecimalText(gMilli, 1000)}`);
    const fracLeft = rng() < 0.5;
    const left = fracLeft ? f : t;
    const right = fracLeft ? t : f;
    const fracBigger = -n / d > -gMilli / 1000;
    const bigger = fracBigger ? f : t;
    const smaller = fracBigger ? t : f;
    const traps: Trap[] = [
      { value: smaller, trap: '负数比较：绝对值大的反而小；先统一成分数或小数再比' },
      { value: sameT, trap: '两边不相等，差了不到 0.2，仔细转换再比' },
    ];
    return makeQuestion({ kind: 'vs', left, right }, '哪边更大？', bigger, traps);
  }
  // 正 vs 负：正数永远更大（秒答题，建立符号直觉）
  const d1 = pick(rng, ARITH_DENOMS);
  const n1 = randomNumerator(rng, d1);
  const d2 = pick(rng, ARITH_DENOMS);
  const n2 = randomNumerator(rng, d2);
  const posE = frac(n1, d1);
  const negE = frac(-n2, d2);
  const negLeft = rng() < 0.5;
  const left = negLeft ? negE : posE;
  const right = negLeft ? posE : negE;
  const traps: Trap[] = [
    { value: negE, trap: '正数永远比负数大' },
    { value: sameT, trap: '一正一负不会相等' },
  ];
  return makeQuestion({ kind: 'vs', left, right }, '哪边更大？', posE, traps);
};

/** 分数符号快闪（三选一）：相反数得 0 12%；其余同分母带符号相加 / 异分母正数相减各半 */
const genSignedFracFlash: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const pos = text('正数');
  const neg = text('负数');
  const zero = text('等于 0');
  const hint = '先估绝对值：同分母比分子，异分母先通分再比；符号跟绝对值大的走';
  const r0 = rng();
  if (r0 < 0.12) {
    // 互为相反数：n/d + (-n/d) = 0
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const first = rng() < 0.5;
    const f1 = frac(n, d);
    const f2 = frac(-n, d);
    return makeQuestion(
      { kind: 'op', op: '+', terms: first ? [f2, f1] : [f1, f2] },
      '不计算，判断结果是正还是负',
      zero,
      [
        { value: pos, trap: '这两个数互为相反数，相加等于 0' },
        { value: neg, trap: '这两个数互为相反数，相加等于 0' },
      ],
    );
  }
  if (r0 < 0.56) {
    // 同分母带符号相加：一正一负，判号 = 比分子大小（排除相等，不会恰为 0）
    const d = pick(rng, SIGNED_PAIR_DENOMS);
    const n1 = randomNumerator(rng, d);
    const n2 = randomNumerator(rng, d, n1);
    const negFirst = rng() < 0.5;
    const terms = negFirst ? [frac(-n1, d), frac(n2, d)] : [frac(n1, d), frac(-n2, d)];
    const v = negFirst ? n2 - n1 : n1 - n2;
    const correct = v > 0 ? pos : neg;
    const traps: Trap[] = [pos, neg, zero]
      .filter((x) => exprKey(x) !== exprKey(correct))
      .map((x) => ({
        value: x,
        trap: exprKey(x) === '等于 0' ? '两个分子不一样大，不会等于 0' : hint,
      }));
    return makeQuestion({ kind: 'op', op: '+', terms }, '不计算，判断结果是正还是负', correct, traps);
  }
  // 异分母正数相减：n1/d1 - n2/d2，要先通分才知道谁大（排除等值）
  const p = pick(rng, [...MULTIPLE_PAIRS, ...COPRIME_PAIRS]);
  const d1 = p[0];
  const d2 = p[1];
  const n1 = randomNumerator(rng, d1);
  let n2 = randomNumerator(rng, d2);
  for (let t = 0; t < 60 && n1 * d2 === n2 * d1; t++) n2 = randomNumerator(rng, d2);
  const v = n1 * d2 - n2 * d1;
  const correct = v > 0 ? pos : neg;
  const traps: Trap[] = [pos, neg, zero]
    .filter((x) => exprKey(x) !== exprKey(correct))
    .map((x) => ({
      value: x,
      trap: exprKey(x) === '等于 0' ? '通分后分子不一样大，不会等于 0' : hint,
    }));
  return makeQuestion(
    { kind: 'op', op: '-', terms: [frac(n1, d1), frac(n2, d2)] },
    '不计算，判断结果是正还是负',
    correct,
    traps,
  );
};

/** 分数正负加减·基础：同分母带符号 45% + 倍数分母 30% + 不够减（结果为负）25% */
const genSignedFracBasic: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const r0 = rng();
  if (r0 < 0.45) {
    // 同分母带符号：通分零负担，专注符号规则
    const d = pick(rng, SIGNED_PAIR_DENOMS);
    const n1 = randomNumerator(rng, d);
    const n2 = randomNumerator(rng, d, n1);
    const s1 = rng() < 0.5 ? 1 : -1;
    const s2 = rng() < 0.5 ? 1 : -1;
    const isSub = rng() < 0.5;
    const e2 = isSub ? -s2 : s2; // 第二项实际参与运算的符号
    const N = s1 * n1 + e2 * n2;
    const correctVal = N / d;
    const traps: Trap[] = [];
    pushTrap(traps, sAnsExpr(-N, d), '符号看反了', correctVal);
    pushTrap(
      traps,
      sAnsExpr(s1 * n1 - e2 * n2, d),
      isSub ? '减去一个数 = 加上它的相反数，符号要变' : '加负数 = 减正数，符号看错了',
      correctVal,
    );
    pushTrap(traps, sAnsExpr(n1 + n2, d), '异号相加是绝对值抵消，不是相加', correctVal);
    sFormTraps(traps, N, d);
    fillTraps(traps, N, d);
    return makeQuestion(
      { kind: 'op', op: isSub ? '-' : '+', terms: [frac(s1 * n1, d), frac(s2 * n2, d)] },
      '计算（注意正负号）',
      sAnsExpr(N, d),
      traps,
    );
  }
  if (r0 < 0.75) {
    // 倍数分母带符号：通分是小倍数，专注符号
    const p = pick(rng, MULTIPLE_PAIRS);
    const d1 = p[0];
    const d2 = p[1];
    const n1 = randomNumerator(rng, d1);
    const n2 = randomNumerator(rng, d2);
    const s1 = rng() < 0.5 ? 1 : -1;
    const s2 = rng() < 0.5 ? 1 : -1;
    const isSub = rng() < 0.5;
    const e2 = isSub ? -s2 : s2;
    const D = lcm(d1, d2);
    const m1 = n1 * (D / d1);
    const m2 = n2 * (D / d2);
    const N = s1 * m1 + e2 * m2;
    const correctVal = N / D;
    const traps: Trap[] = [];
    pushTrap(traps, sAnsExpr(-N, D), '符号看反了', correctVal);
    pushTrap(
      traps,
      sAnsExpr(s1 * m1 - e2 * m2, D),
      isSub ? '减去一个数 = 加上它的相反数，符号要变' : '加负数 = 减正数，符号看错了',
      correctVal,
    );
    pushTrap(traps, sAnsExpr(s1 * n1 + e2 * n2, D), '通分后分子也要乘同样的倍数', correctVal);
    sFormTraps(traps, N, D);
    fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: isSub ? '-' : '+', terms: [frac(s1 * n1, d1), frac(s2 * n2, d2)] },
      '计算（注意正负号）',
      sAnsExpr(N, D),
      traps,
    );
  }
  // 不够减专项：正数 − 正数，结果为负（小学从未见过的结构，初中第一道坎）
  const q = pickAddSubPair(rng);
  const swap = q.n1 * q.d2 > q.n2 * q.d1;
  const a1 = swap ? q.n2 : q.n1;
  const b1 = swap ? q.d2 : q.d1;
  const a2 = swap ? q.n1 : q.n2;
  const b2 = swap ? q.d1 : q.d2;
  const D = lcm(b1, b2);
  const N = a1 * (D / b1) - a2 * (D / b2); // ≤ 0
  const correctVal = N / D;
  const traps: Trap[] = [];
  pushTrap(traps, sAnsExpr(-N, D), '不够减时结果是负数：小数减大数，差的前面加负号，不是倒过来减', correctVal);
  pushTrap(traps, sAnsExpr(a1 * (D / b1) + a2 * (D / b2), D), '把减法算成加法了', correctVal);
  pushTrap(traps, sAnsExpr(N + 1, D), '分子减错了，再算一遍', correctVal);
  sFormTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '-', terms: [frac(a1, b1), frac(a2, b2)] },
    '计算（注意正负号）',
    sAnsExpr(N, D),
    traps,
  );
};

/** 分数正负混合·进阶：互质异号相加 40% + 减负数 30% + 小数分数混合 20% + 三项代数和 10% */
const genSignedFracAdv: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const r0 = rng();
  if (r0 < 0.4) {
    // 互质分母严格异号相加：一正一负，考"抵消 + 符号跟绝对值大的走"
    const p = pick(rng, COPRIME_PAIRS);
    const d1 = p[0];
    const d2 = p[1];
    const n1 = randomNumerator(rng, d1);
    const n2 = randomNumerator(rng, d2);
    const negFirst = rng() < 0.5;
    const D = lcm(d1, d2);
    const m1 = n1 * (D / d1);
    const m2 = n2 * (D / d2);
    const N = negFirst ? -m1 + m2 : m1 - m2;
    const correctVal = N / D;
    const traps: Trap[] = [];
    pushTrap(traps, sAnsExpr(m1 + m2, D), '异号相加是绝对值抵消，不是相加', correctVal);
    pushTrap(traps, sAnsExpr(-m1 - m2, D), '异号相加是绝对值抵消，不是相加', correctVal);
    pushTrap(traps, sAnsExpr(-N, D), '符号看反了：跟绝对值大的数走', correctVal);
    sFormTraps(traps, N, D);
    fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: '+', terms: [frac(negFirst ? -n1 : n1, d1), frac(negFirst ? n2 : -n2, d2)] },
      '计算（注意正负号）',
      sAnsExpr(N, D),
      traps,
    );
  }
  if (r0 < 0.7) {
    // 减负数：正 − 负 = 相加、负 − 正 = 负的相加，各半
    const p = pick(rng, [...MULTIPLE_PAIRS, ...COPRIME_PAIRS]);
    const d1 = p[0];
    const d2 = p[1];
    const n1 = randomNumerator(rng, d1);
    const n2 = randomNumerator(rng, d2);
    const posMinusNeg = rng() < 0.5;
    const D = lcm(d1, d2);
    const m1 = n1 * (D / d1);
    const m2 = n2 * (D / d2);
    const N = posMinusNeg ? m1 + m2 : -m1 - m2;
    const correctVal = N / D;
    const traps: Trap[] = [];
    pushTrap(traps, sAnsExpr(posMinusNeg ? m1 - m2 : -m1 + m2, D), '减负数 = 加正数，符号要变', correctVal);
    pushTrap(traps, sAnsExpr(posMinusNeg ? -m1 + m2 : m1 - m2, D), '减负数 = 加正数，符号要变', correctVal);
    pushTrap(traps, sAnsExpr(-N, D), '符号看反了', correctVal);
    sFormTraps(traps, N, D);
    fillTraps(traps, N, D);
    const terms = posMinusNeg ? [frac(n1, d1), frac(-n2, d2)] : [frac(-n1, d1), frac(n2, d2)];
    return makeQuestion({ kind: 'op', op: '-', terms }, '计算（注意正负号）', sAnsExpr(N, D), traps);
  }
  if (r0 < 0.9) {
    // 小数分数混合带符号：小数来自 DEC_ANCHORS 加负号，分数带符号（转换是已训练的原子能力）
    const [decS, dn, dd] = pick(rng, DEC_ANCHORS);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const decNeg = rng() < 0.5;
    const fracNeg = rng() < 0.5;
    const isSub = rng() < 0.5;
    const D = lcm(dd, d);
    const sD = decNeg ? -1 : 1;
    const eF = (fracNeg ? -1 : 1) * (isSub ? -1 : 1); // 分数项实际参与运算的符号
    const N = sD * dn * (D / dd) + eF * n * (D / d);
    const correctVal = N / D;
    const traps: Trap[] = [];
    pushTrap(traps, sAnsExpr(-N, D), '符号看反了', correctVal);
    pushTrap(
      traps,
      sAnsExpr(sD * dn * (D / dd) - eF * n * (D / d), D),
      isSub ? '减去一个数 = 加上它的相反数，符号要变' : '加负数 = 减正数，符号看错了',
      correctVal,
    );
    pushTrap(traps, sAnsExpr(sD * dn * (D / dd) + eF * n, D), '通分后分子也要乘同样的倍数', correctVal);
    sFormTraps(traps, N, D);
    fillTraps(traps, N, D);
    return makeQuestion(
      { kind: 'op', op: isSub ? '-' : '+', terms: [text(decNeg ? `-${decS}` : decS), frac(fracNeg ? -n : n, d)] },
      '计算（注意正负号）',
      sAnsExpr(N, D),
      traps,
    );
  }
  // 三项代数和：分母组合 [2,3,4] [2,3,6] [3,4,6] [2,4,8]，公分母 ≤ 12
  const ds = pick(rng, [[2, 3, 4], [2, 3, 6], [3, 4, 6], [2, 4, 8]]);
  const n1 = randomNumerator(rng, ds[0]);
  const n2 = randomNumerator(rng, ds[1]);
  const n3 = randomNumerator(rng, ds[2]);
  const s1 = rng() < 0.5 ? 1 : -1;
  const s2 = rng() < 0.5 ? 1 : -1;
  const s3 = rng() < 0.5 ? 1 : -1;
  const D = lcm(lcm(ds[0], ds[1]), ds[2]);
  const m1 = n1 * (D / ds[0]);
  const m2 = n2 * (D / ds[1]);
  const m3 = n3 * (D / ds[2]);
  const N = s1 * m1 + s2 * m2 + s3 * m3;
  const correctVal = N / D;
  const traps: Trap[] = [];
  pushTrap(traps, sAnsExpr(-N, D), '符号看反了', correctVal);
  pushTrap(traps, sAnsExpr(s1 * m1 + s2 * m2 - s3 * m3, D), '最后一项的符号看错了', correctVal);
  pushTrap(traps, sAnsExpr((m1 + m2 + m3) * (N >= 0 ? -1 : 1), D), '不能全当同号相加，负项要抵消', correctVal);
  sFormTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: 'op', op: '+', terms: [frac(s1 * n1, ds[0]), frac(s2 * n2, ds[1]), frac(s3 * n3, ds[2])] },
    '计算（注意正负号）',
    sAnsExpr(N, D),
    traps,
  );
};

const signedFracCmpSkill: Skill = {
  id: 'g6-signed-frac-cmp',
  title: '负分数比大小',
  intro: [
    '考核点：含负分数的大小比较（教材 1.1 延伸，原子能力 B2 进阶）',
    '核心直觉：负数比较，绝对值大的反而小（-1/2 < -1/3）',
    '含负分数 vs 负小数（先统一形态再比）与等值变形（-1/2 和 -0.5 一样大）',
    '本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignedFracCmp],
};

const signedFracFlashSkill: Skill = {
  id: 'g6-signed-frac-flash',
  title: '分数符号快闪',
  intro: [
    '考核点：不计算，判断分数加减结果的正负（原子能力 C3 进阶）',
    '先估绝对值：同分母比分子，异分母先通分再比；符号跟绝对值大的走',
    '约一成题目互为相反数，结果等于 0',
    '本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 5,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignedFracFlash],
};

const signedFracBasicSkill: Skill = {
  id: 'g6-signed-frac-basic',
  title: '分数正负加减·基础',
  intro: [
    '考核点：带符号分数加减（同分母 45% + 倍数分母 30% + 不够减 25%）',
    '先定符号再算绝对值；不够减时结果是负数（小数减大数，差的前面加负号）',
    '答案要约到最简；复习模式键盘有负号键，负数答案先按 − 再输数字',
  ],
  timeLimitSec: 10,
  questionCount: 10,
  allowNegative: true,
  acceptImproper: true,
  hideMixedKey: true,
  generators: [genSignedFracBasic],
};

const signedFracAdvSkill: Skill = {
  id: 'g6-signed-frac-adv',
  title: '分数正负混合·进阶',
  intro: [
    '考核点：互质分母异号相加 40% + 减负数 30% + 小数分数混合 20% + 三项代数和 10%',
    '口诀：减去负数 = 加正数；异号相加，符号跟绝对值大的走',
    '小数都来自常考锚点（0.5、0.25、0.125……），先转换再算',
    '复习模式键盘有负号键，负数答案先按 − 再输数字',
  ],
  timeLimitSec: 14,
  questionCount: 10,
  allowNegative: true,
  acceptImproper: true,
  hideMixedKey: true,
  generators: [genSignedFracAdv],
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
    '本题型只有闯关和进阶两种模式',
  ],
  timeLimitSec: 8, // 2026-10-02 从 5 秒调到 8 秒：4 项式子 5 秒读不完（女儿实测反馈）
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

/** 乘方速记（二阶段，当前版本）：平方 35%（11~20 必背 + 1~10 穿插陷阱）+ 立方 2~6（20%）+ 整十平方/高次幂/(-1)ⁿ 各 10% + 符号陷阱综合 15% */
/** 整数 → 上标文本（支持多位指数，如 14 → ¹⁴） */
const sup = (n: number): string => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);

const genPowerFlash: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  // 2026-10-06 二阶段（用户拍板启用）：一阶段负数乘方基础上加回背诵类——
  // 平方 35%（一半 11²~20² 必背，一半 1~10 且 30% 穿插符号陷阱）、立方 2~6 占 20%（30% 陷阱）、
  // 整十平方 30²~90² 占 10%、高次幂 2⁴~2⁶/10²~10⁴ 占 10%、(-1)ⁿ/-1ⁿ 降回 10%、符号陷阱综合抽查 15%。
  // 规划见 docs/乘方速记两阶段规划.md
  const kind = rng();
  if (kind < 0.35) {
    // 平方考核：一半 11²~20² 必背；一半 1~10（30% 穿插符号陷阱）
    if (rng() < 0.5) {
      const n = 11 + Math.floor(rng() * 10);
      const v = n * n;
      const traps: Trap[] = [];
      pushTextTrap(traps, n * 20, '平方是 n×n，不是 n×2', v * 10);
      pushTextTrap(traps, (n - 1) * (n - 1) * 10, '记岔了：这是相邻的平方数', v * 10);
      pushTextTrap(traps, (n + 1) * (n + 1) * 10, '记岔了：这是相邻的平方数', v * 10);
      fillTextTraps(traps, v * 10);
      return makeQuestion(text(`${n}²`), '秒答', text(String(v)), traps);
    }
    const a = 1 + Math.floor(rng() * 10);
    if (rng() < 0.3) {
      const inParens = rng() < 0.5;
      const v = inParens ? a * a : -a * a;
      const traps: Trap[] = [];
      pushTextTrap(traps, -v * 10, inParens ? '负数的平方是正数' : '负号在平方外面：先算平方再添负号', v * 10);
      pushTextTrap(traps, (inParens ? a * 2 : -a * 2) * 10, '平方是 a×a，不是 a×2', v * 10);
      fillTextTraps(traps, v * 10);
      return makeQuestion(text(inParens ? `(-${a})²` : `-${a}²`), '计算（看清负号位置）', text(String(v)), traps);
    }
    const v = a * a;
    const traps: Trap[] = [];
    pushTextTrap(traps, a * 20, '平方是 a×a，不是 a×2', v * 10);
    if (a > 1) pushTextTrap(traps, (a - 1) * (a - 1) * 10, '记岔了：这是相邻的平方数', v * 10);
    pushTextTrap(traps, (a + 1) * (a + 1) * 10, '记岔了：这是相邻的平方数', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${a}²`), '秒答', text(String(v)), traps);
  }
  if (kind < 0.55) {
    // 立方考核：底数 2~6，70% 正数立方，30% 符号陷阱 (-a)³
    const a = 2 + Math.floor(rng() * 5);
    if (rng() < 0.3) {
      const v = -a * a * a;
      const traps: Trap[] = [];
      pushTextTrap(traps, -v * 10, '负数的立方还是负数（三个负号）', v * 10);
      pushTextTrap(traps, a * 30, '立方是 a×a×a，不是 a×3', v * 10);
      fillTextTraps(traps, v * 10);
      return makeQuestion(text(`(-${a})³`), '计算（看清符号）', text(String(v)), traps);
    }
    const v = a * a * a;
    const traps: Trap[] = [];
    pushTextTrap(traps, a * 30, '立方是 a×a×a，不是 a×3', v * 10);
    pushTextTrap(traps, a * a * 10, '这是平方，立方要再乘一个 a', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${a}³`), '秒答', text(String(v)), traps);
  }
  if (kind < 0.65) {
    // 整十平方 30²~90²：n² = (n/10)² 添两个 0
    const n = (3 + Math.floor(rng() * 7)) * 10;
    const v = n * n;
    const traps: Trap[] = [];
    pushTextTrap(traps, n * 20, '平方是 n×n，不是 n×2', v * 10);
    pushTextTrap(traps, v, '少了一个 0：先算 3²=9，再添两个 0', v * 10);
    pushTextTrap(traps, v * 100, '多了一个 0：先算 3²=9，再添两个 0', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${n}²`), '秒答', text(String(v)), traps);
  }
  if (kind < 0.75) {
    // 高次幂秒答：2⁴~2⁶、10²~10⁴
    const SPECIAL: [number, number][] = [[2, 4], [2, 5], [2, 6], [10, 2], [10, 3], [10, 4]];
    const [b, e] = pick(rng, SPECIAL);
    const v = Math.pow(b, e);
    const traps: Trap[] = [];
    pushTextTrap(traps, b * e * 10, '乘方是几个底数相乘，不是底数 × 指数', v * 10);
    pushTextTrap(traps, (v / b) * 10, '少乘了一个底数', v * 10);
    pushTextTrap(traps, v * b * 10, '多乘了一个底数', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(`${b}${sup(e)}`), '秒答', text(String(v)), traps);
  }
  if (kind < 0.85) {
    // (-1)ⁿ 与 -1ⁿ：奇偶定号；括号外的负号结果永远是 -1（二阶段降回 10%）
    const n = 10 + Math.floor(rng() * 30);
    const inParens = rng() < 0.5;
    const v = inParens ? (n % 2 === 0 ? 1 : -1) : -1;
    const traps: Trap[] = [];
    pushTextTrap(traps, -v * 10, inParens ? '奇数个 -1 相乘得 -1，偶数个得 1' : '负号在括号外面，不管几次方结果都是 -1', v * 10);
    pushTextTrap(traps, n * 10, '答案只会是 1 或 -1，指数只决定正负', v * 10);
    fillTextTraps(traps, v * 10);
    return makeQuestion(text(inParens ? `(-1)${sup(n)}` : `-1${sup(n)}`), '秒答', text(String(v)), traps);
  }
  // 符号陷阱综合抽查（15%）：平方立方混合，检验负号位置是否真掌握
  const sq = rng() < 0.6;
  const a = sq ? 1 + Math.floor(rng() * 10) : 2 + Math.floor(rng() * 3);
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
    '二阶段：平方 1²~20²、立方 2³~6³、整十平方（40²=1600）、2⁴~2⁶ 与 10 的幂',
    '(-1)ⁿ 看指数奇偶；符号陷阱综合抽查：(-3)² = 9 但 -3² = -9，看清负号位置！',
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

/* ---------------- 五年级 5.0 数感地基 · 因数与倍数 ----------------
 * 2026-10-13 新增（用户拍板）：约分/通分只是"用到"公因数公倍数，不等于"学会"，
 * 按五年级教材难度把地基拆成独立训练链：因数枚举 → 整除特征 → 质数合数 → 最大公因数 → 最小公倍数。
 * 难度封顶：N ≤ 100、分解质因数质因子（按重数计）≤ 4 个、不碰竞赛内容。
 */

/** N 的因数列表（升序） */
const factorsOf = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
};

/** 末两位补零文本：5 → "05" */
const pad2 = (x: number): string => String(x).padStart(2, '0');

/** 质数判断 */
const isPrimeNum = (n: number): boolean => {
  if (n < 2) return false;
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return false;
  return true;
};

/** 最小质因数 */
const smallestPrimeFactor = (n: number): number => {
  let p = 2;
  while (n % p !== 0) p++;
  return p;
};

/** 分解质因数 → [质因子, 指数][]（升序） */
const factorize = (n: number): [number, number][] => {
  const out: [number, number][] = [];
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    if (x % p === 0) {
      let e = 0;
      while (x % p === 0) {
        x = x / p;
        e++;
      }
      out.push([p, e]);
    }
  }
  if (x > 1) out.push([x, 1]);
  return out;
};

/** 质因子列表（含重数，升序）：12 → [2, 2, 3] */
const factorList = (n: number): number[] => {
  const out: number[] = [];
  for (const [p, e] of factorize(n)) for (let i = 0; i < e; i++) out.push(p);
  return out;
};

/** 因子列表 → 标准分解文本：[2, 2, 3] → 2²×3 */
const factorListText = (list: number[]): string => {
  const parts: string[] = [];
  let i = 0;
  while (i < list.length) {
    let j = i;
    while (j < list.length && list[j] === list[i]) j++;
    parts.push(j - i === 1 ? String(list[i]) : `${list[i]}${sup(j - i)}`);
    i = j;
  }
  return parts.join('×');
};

/** 分解质因数标准文本：12 → 2²×3 */
const factorText = (n: number): string => factorListText(factorList(n));

/** 因数枚举宿主数：≤100、因数总数 ≥5（即非平凡因数 ≥3 个）的合数 */
const FACTOR_HOSTS: number[] = [];
for (let n = 4; n <= 100; n++) if (factorsOf(n).length >= 5) FACTOR_HOSTS.push(n);

/** 互质乘数对（都 ≥2 且互质）：构造"有公因数 g 但非倍数关系"的数对 */
const COP_MULT: [number, number][] = [
  [2, 3],
  [2, 5],
  [3, 4],
  [3, 5],
  [4, 5],
];

/** 互质数对（两数 ≤ 50，混合 质+合 / 合+合 / 相邻数） */
const COP_PAIRS: [number, number][] = [
  [4, 9], [8, 9], [4, 15], [9, 10], [6, 35], [8, 15], [9, 20], [14, 15], [21, 22], [25, 26],
  [12, 35], [7, 12], [8, 21], [9, 25], [10, 21], [4, 25], [6, 25], [27, 28], [33, 35], [20, 21],
  [7, 9], [8, 27], [13, 14], [16, 25], [24, 25],
];

/** 互质数对（乘积 ≤ 100，供最小公倍数"互质直接乘"题型） */
const COP_PAIRS_SMALL: [number, number][] = [
  [2, 3], [2, 5], [2, 7], [2, 9], [3, 4], [3, 5], [3, 7], [3, 8], [3, 10], [4, 5],
  [4, 7], [4, 9], [5, 6], [5, 7], [5, 8], [5, 9], [6, 7], [7, 8], [7, 9], [8, 9],
  [2, 11], [3, 11], [4, 11], [7, 10], [9, 10], [5, 11], [8, 11], [9, 11],
];

/** 有公因数但非倍数关系的数对（最小公倍数 ≤ 100） */
const LCM_PAIRS: [number, number][] = [
  [4, 6], [6, 8], [6, 9], [6, 10], [8, 10], [8, 12], [9, 12], [10, 12], [10, 15], [12, 14],
  [12, 15], [12, 16], [12, 18], [14, 21], [15, 20], [10, 14], [8, 14], [9, 15], [16, 20], [15, 25],
  [20, 25], [12, 20], [16, 24], [18, 27], [20, 30], [6, 15], [4, 10], [4, 14], [6, 14],
];

/** 因数枚举（数感地基 1/5）：选因数 40% / 选非因数 25% / 因数个数 20% / 因数配对 15% */
const genFactorSense: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  const N = pick(rng, FACTOR_HOSTS);
  const factors = factorsOf(N);
  const nontrivial = factors.filter((f) => f > 1 && f < N);
  if (kind < 0.4) {
    // 选出 N 的因数：干扰项 = 邻近但不能整除的数
    const c = pick(rng, nontrivial);
    const traps: Trap[] = [];
    for (let dt = 1; traps.length < 3 && dt <= 10; dt++) {
      for (const t of [c - dt, c + dt]) {
        if (traps.length >= 3) break;
        if (t <= 1 || t >= N || N % t === 0) continue;
        traps.push({ value: text(String(t)), trap: `${N} ÷ ${t} 有余数，${t} 不是 ${N} 的因数` });
      }
    }
    return makeQuestion(text(`${N} 的因数`), '下面哪个是？', text(String(c)), traps);
  }
  if (kind < 0.65) {
    // 选出不是 N 的因数：干扰项 = 3 个真因数
    const non: number[] = [];
    for (let t = 2; t < N; t++) if (N % t !== 0) non.push(t);
    const c = pick(rng, non);
    const traps: Trap[] = [];
    const used = new Set<number>();
    while (traps.length < 3) {
      const f = pick(rng, nontrivial);
      if (used.has(f)) continue;
      used.add(f);
      traps.push({ value: text(String(f)), trap: `${f} 是 ${N} 的因数（${N} ÷ ${f} = ${N / f}）` });
    }
    return makeQuestion(text(`${N} 的因数`), '下面哪个不是？', text(String(c)), traps);
  }
  if (kind < 0.85) {
    // 因数个数：只出因数总数 5~9 的数（太多没有秒答价值）
    let N2 = N;
    for (let tries = 0; tries < 50 && factorsOf(N2).length > 9; tries++) N2 = pick(rng, FACTOR_HOSTS);
    const tau = factorsOf(N2).length;
    const traps: Trap[] = [];
    pushTextTrap(traps, (tau - 2) * 10, '漏数了 1 和它自己', tau * 10);
    pushTextTrap(traps, (tau - 1) * 10, '漏了一对——因数都是成对出现的', tau * 10);
    pushTextTrap(traps, (tau + 1) * 10, '多数了一个，再核对一遍', tau * 10);
    return makeQuestion(text(String(N2)), '它的因数有几个？', text(String(tau)), traps);
  }
  // 因数配对：N = a ×（ ）
  const a = pick(rng, nontrivial);
  const b = N / a;
  const traps: Trap[] = [];
  for (const t of [b + 1, b - 1, b + 2, b - 2, b + 3]) {
    if (traps.length >= 3) break;
    if (t <= 0 || t === b) continue;
    traps.push({ value: text(String(t)), trap: `${a} × ${t} = ${a * t}，不是 ${N}` });
  }
  return makeQuestion(text(`${N} = ${a} ×（ ）`), '括号里填几？', text(String(b)), traps);
};

/** 整除特征（数感地基 2/5）：3/9 数字和 55%、2/5 个位 20%、6/10 双条件 15%、4/25 末两位 10% */
const genDivisSense: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.55) {
    // 数字和规则：3（30%）或 9（25%）
    const m = kind < 0.3 ? 3 : 9;
    const len = rng() < 0.5 ? 3 : 4;
    let prefix = 1 + Math.floor(rng() * 9);
    for (let i = 0; i < len - 2; i++) prefix = prefix * 10 + Math.floor(rng() * 10);
    let S = 0;
    for (const ch of String(prefix)) S += Number(ch);
    const rc = (m - (S % m)) % m; // 末位需要满足的 mod m 余数
    const okDigits: number[] = [];
    const badDigits: number[] = [];
    for (let d = 0; d <= 9; d++) (d % m === rc ? okDigits : badDigits).push(d);
    const last = pick(rng, okDigits);
    const N = prefix * 10 + last;
    const traps: Trap[] = [];
    const used = new Set<number>();
    while (traps.length < 3) {
      const w = pick(rng, badDigits);
      if (used.has(w)) continue;
      used.add(w);
      traps.push({ value: text(String(prefix * 10 + w)), trap: `数字和是 ${S + w}，不能被 ${m} 整除` });
    }
    return makeQuestion(text(`下面哪个数能被 ${m} 整除？`), '整除判断（算数字和）', text(String(N)), traps);
  }
  if (kind < 0.75) {
    // 个位规则：2 或 5
    const m = rng() < 0.5 ? 2 : 5;
    const valid = m === 2 ? [0, 2, 4, 6, 8] : [0, 5];
    const validText = m === 2 ? '0、2、4、6、8' : '0 或 5';
    const prefix = 10 + Math.floor(rng() * 989); // 10~998
    const last = pick(rng, valid);
    const N = prefix * 10 + last;
    const traps: Trap[] = [];
    const used = new Set<number>(valid);
    while (traps.length < 3) {
      const w = Math.floor(rng() * 10);
      if (used.has(w)) continue;
      used.add(w);
      traps.push({ value: text(String(prefix * 10 + w)), trap: `被 ${m} 整除的数，个位只能是 ${validText}` });
    }
    return makeQuestion(text(`下面哪个数能被 ${m} 整除？`), '整除判断（看个位）', text(String(N)), traps);
  }
  if (kind < 0.9) {
    // 双条件：6（偶数 + 数字和能被 3 整除）或 10（个位 0）
    if (rng() < 0.5) {
      const prefix = 10 + Math.floor(rng() * 989);
      const N = prefix * 10;
      const traps: Trap[] = [
        { value: text(String(prefix * 10 + 5)), trap: '个位是 5 只能被 5 整除，10 的倍数个位必须是 0' },
      ];
      const used = new Set<number>([0, 5]);
      while (traps.length < 3) {
        const w = 1 + Math.floor(rng() * 9);
        if (used.has(w)) continue;
        used.add(w);
        traps.push({ value: text(String(prefix * 10 + w)), trap: '10 的倍数个位必须是 0' });
      }
      return makeQuestion(text('下面哪个数能被 10 整除？'), '整除判断', text(String(N)), traps);
    }
    // 6
    let prefix = 1 + Math.floor(rng() * 9);
    prefix = prefix * 10 + Math.floor(rng() * 10); // 前两位
    let S = 0;
    for (const ch of String(prefix)) S += Number(ch);
    const rc = (3 - (S % 3)) % 3;
    const okEven: number[] = []; // 偶数且余数对 → 正确答案
    const oddOk: number[] = []; // 奇数但数字和对 → 陷阱 a
    const evenBad: number[] = []; // 偶数但数字和不对 → 陷阱 b
    const oddBad: number[] = []; // 奇数且不对 → 陷阱 c
    for (let d = 0; d <= 9; d++) {
      const even = d % 2 === 0;
      const ok = d % 3 === rc;
      if (even && ok) okEven.push(d);
      else if (!even && ok) oddOk.push(d);
      else if (even) evenBad.push(d);
      else oddBad.push(d);
    }
    const last = pick(rng, okEven);
    const N = prefix * 10 + last;
    const w1 = pick(rng, oddOk);
    const w2 = pick(rng, evenBad);
    const w3 = pick(rng, oddBad);
    const traps: Trap[] = [
      { value: text(String(prefix * 10 + w1)), trap: '数字和能被 3 整除，但它是奇数——6 的倍数必须是偶数' },
      { value: text(String(prefix * 10 + w2)), trap: '是偶数，但数字和不能被 3 整除' },
      { value: text(String(prefix * 10 + w3)), trap: '既不是偶数，数字和也不能被 3 整除' },
    ];
    return makeQuestion(text('下面哪个数能被 6 整除？'), '整除判断（两个条件都要满足）', text(String(N)), traps);
  }
  // 末两位规则：4 或 25
  if (rng() < 0.5) {
    const prefix = 1 + Math.floor(rng() * 98);
    const e = Math.floor(rng() * 25) * 4;
    const N = prefix * 100 + e;
    const traps: Trap[] = [];
    for (const dt of [2, 6, 10]) {
      const w = (e + dt) % 100;
      traps.push({ value: text(String(prefix * 100 + w)), trap: `末两位 ${pad2(w)} 除以 4 有余数，被 4 整除要看末两位` });
    }
    return makeQuestion(text('下面哪个数能被 4 整除？'), '整除判断（看末两位）', text(String(N)), traps);
  }
  const prefix = 1 + Math.floor(rng() * 98);
  const e = pick(rng, [0, 25, 50, 75]);
  const N = prefix * 100 + e;
  const pool = [5, 15, 20, 35, 45, 65, 85, 95];
  const traps: Trap[] = [];
  const used = new Set<number>();
  while (traps.length < 3) {
    const w = pick(rng, pool);
    if (used.has(w)) continue;
    used.add(w);
    traps.push({ value: text(String(prefix * 100 + w)), trap: `末两位 ${pad2(w)} 不行——被 25 整除末两位只能是 00、25、50、75` });
  }
  return makeQuestion(text('下面哪个数能被 25 整除？'), '整除判断（看末两位）', text(String(N)), traps);
};

/** 100 以内质数 */
const PRIMES_100: number[] = [];
for (let n = 2; n <= 100; n++) if (isPrimeNum(n)) PRIMES_100.push(n);

/** 看着像质数的合数（经典伪装者：51=3×17、57=3×19、91=7×13 等） */
const PSEUDO_PRIMES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 81, 85, 87, 91, 93, 95, 99];

/** 分解质因数宿主：4~100 的合数，质因子（按重数计）≤ 4 个 */
const FACTORIZE_HOSTS: number[] = [];
for (let n = 4; n <= 100; n++) if (!isPrimeNum(n) && factorList(n).length <= 4) FACTORIZE_HOSTS.push(n);

/** 质数与合数（数感地基 3/5）：辨质数 35% / 分解质因数 45% / 质因数个数与最小质因数 20% */
const genPrimeSense: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.35) {
    // 辨质数
    const c = pick(rng, PRIMES_100);
    const traps: Trap[] = [];
    if (rng() < 0.2) traps.push({ value: text('1'), trap: '1 既不是质数也不是合数' });
    const used = new Set<number>();
    while (traps.length < 3) {
      const t = pick(rng, PSEUDO_PRIMES);
      if (used.has(t)) continue;
      used.add(t);
      const sp = smallestPrimeFactor(t);
      traps.push({ value: text(String(t)), trap: `${t} = ${sp} × ${t / sp}，是合数` });
    }
    return makeQuestion(text('下面哪个是质数？'), '判断', text(String(c)), traps);
  }
  if (kind < 0.8) {
    // 分解质因数：选标准写法
    const N = pick(rng, FACTORIZE_HOSTS);
    const list = factorList(N);
    const correct = factorText(N);
    const traps: Trap[] = [];
    if (list.length >= 3) {
      // 未分完：合并前两个因子（如 12 = 4×3）
      const merged = list[0] * list[1];
      traps.push({
        value: text(factorListText([merged, ...list.slice(2)])),
        trap: `${merged} 不是质数，要分解到每个数都是质数`,
      });
    } else {
      traps.push({ value: text(`1×${correct}`), trap: '1 不是质数，分解质因数不能写 1' });
    }
    // 少乘一个：去掉最后一个因子
    const prod1 = N / list[list.length - 1];
    traps.push({ value: text(factorListText(list.slice(0, -1))), trap: `乘积只有 ${prod1}，少乘了一个质因数` });
    // 乘积错：最小因子 +1
    const listW = [list[0] + 1, ...list.slice(1)].sort((x, y) => x - y);
    let prodW = 1;
    for (const f of listW) prodW *= f;
    traps.push({ value: text(factorListText(listW)), trap: `乘积是 ${prodW}，不是 ${N}` });
    return makeQuestion(text(`把 ${N} 分解质因数`), '选出标准写法', text(correct), traps);
  }
  if (rng() < 0.5) {
    // 不同质因数个数（只出 ≥2 个质因子的合数）
    let N = pick(rng, FACTORIZE_HOSTS);
    for (let tries = 0; tries < 50 && factorize(N).length < 2; tries++) N = pick(rng, FACTORIZE_HOSTS);
    const cnt = factorize(N).length;
    const total = factorList(N).length;
    const traps: Trap[] = [];
    pushTextTrap(traps, total * 10, '相同的质因数只算一个，不能重复计数', cnt * 10);
    pushTextTrap(traps, (cnt - 1) * 10, '漏数了一个质因数', cnt * 10);
    pushTextTrap(traps, (cnt + 1) * 10, '多算了一个，相同的质因数只算一次', cnt * 10);
    fillTextTraps(traps, cnt * 10);
    return makeQuestion(text(String(N)), '它的不同质因数有几个？', text(String(cnt)), traps);
  }
  // 最小质因数
  const N = pick(rng, FACTORIZE_HOSTS);
  const primes = factorize(N).map(([p]) => p);
  const spf = primes[0];
  const traps: Trap[] = [];
  if (primes.length > 1)
    pushTextTrap(traps, primes[primes.length - 1] * 10, `那是 ${N} 的质因数，但不是最小的`, spf * 10);
  pushTextTrap(traps, 10, '1 不是质数', spf * 10);
  pushTextTrap(
    traps,
    (spf + 1) * 10,
    N % (spf + 1) === 0 ? `${spf + 1} 是 ${N} 的质因数，但不是最小的` : `${spf + 1} 不能整除 ${N}`,
    spf * 10,
  );
  fillTextTraps(traps, spf * 10);
  return makeQuestion(text(String(N)), '它的最小质因数是？', text(String(spf)), traps);
};

/** 最大公因数（数感地基 4/5）：倍数关系 30% / 常见小数字对 30% / 互质对 20% / 稍大常见对 20% */
const genGcdSense: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.3) {
    // 倍数关系：答案是小数本身
    const a = 3 + Math.floor(rng() * 10); // 3~12
    const k = 2 + Math.floor(rng() * 7); // 2~8
    const b = a * k;
    const traps: Trap[] = [];
    pushTextTrap(traps, b * 10, '那是最小公倍数！倍数关系中，最大公因数是较小的数本身', a * 10);
    pushTextTrap(traps, 10, '1 是所有数的公因数，但它们有更大的', a * 10);
    pushTextTrap(traps, (a + 1) * 10, `${a + 1} 不能整除 ${a}`, a * 10);
    return makeQuestion(text(`${a} 和 ${b}`), '最大公因数是？', text(String(a)), traps);
  }
  if (kind < 0.6) {
    // 常见小数字对：g∈2~9 × 互质乘数对，两数 ≤ 50
    let g = 2;
    let a = 4;
    let b = 6;
    for (let tries = 0; tries < 50; tries++) {
      const tg = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9]);
      const [x, y] = pick(rng, COP_MULT);
      if (tg * y <= 50) {
        g = tg;
        a = tg * x;
        b = tg * y;
        break;
      }
    }
    const traps: Trap[] = [];
    for (let d = 2; d < g; d++) {
      if (g % d === 0) pushTextTrap(traps, d * 10, `${d} 也是公因数，但不是最大的`, g * 10);
    }
    pushTextTrap(traps, 10, `1 是公因数，但 ${a} 和 ${b} 都能被 ${g} 整除`, g * 10);
    pushTextTrap(traps, (b - a) * 10, '两数之差不是最大公因数', g * 10);
    pushTextTrap(traps, (g + 1) * 10, `${g + 1} 不能同时整除 ${a} 和 ${b}`, g * 10);
    fillTextTraps(traps, g * 10);
    return makeQuestion(text(`${a} 和 ${b}`), '最大公因数是？', text(String(g)), traps);
  }
  if (kind < 0.8) {
    // 互质对：答案是 1
    const [a, b] = pick(rng, COP_PAIRS);
    const traps: Trap[] = [];
    pushTextTrap(traps, Math.min(a, b) * 10, '较小数整除不了较大数——它们互质，最大公因数就是 1', 10);
    pushTextTrap(traps, smallestPrimeFactor(a) * 10, `${smallestPrimeFactor(a)} 能整除 ${a}，但整除不了 ${b}`, 10);
    pushTextTrap(traps, smallestPrimeFactor(b) * 10, `${smallestPrimeFactor(b)} 能整除 ${b}，但整除不了 ${a}`, 10);
    fillTextTraps(traps, 10);
    return makeQuestion(text(`${a} 和 ${b}`), '最大公因数是？', text('1'), traps);
  }
  // 稍大常见对：g ∈ {6,8,9,10,12,15,20,25} × 互质乘数对，两数 ≤ 100
  let g = 6;
  let a = 12;
  let b = 18;
  for (let tries = 0; tries < 50; tries++) {
    const tg = pick(rng, [6, 8, 9, 10, 12, 15, 20, 25]);
    const [x, y] = pick(rng, COP_MULT);
    if (tg * y <= 100) {
      g = tg;
      a = tg * x;
      b = tg * y;
      break;
    }
  }
  const L = (a * b) / g;
  const traps: Trap[] = [];
  if (L <= 200) pushTextTrap(traps, L * 10, '那是公倍数，不是公因数！问的是最大公因数', g * 10);
  pushTextTrap(traps, (g / smallestPrimeFactor(g)) * 10, `${g / smallestPrimeFactor(g)} 是公因数，但不是最大的`, g * 10);
  pushTextTrap(traps, 10, `它们都能被 ${g} 整除，1 不是最大的`, g * 10);
  fillTextTraps(traps, g * 10);
  return makeQuestion(text(`${a} 和 ${b}`), '最大公因数是？', text(String(g)), traps);
};

/** 最小公倍数（数感地基 5/5）：倍数关系 30% / 互质对 30% / 有公因数对 40% */
const genLcmSense: QuestionGenerator = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.3) {
    // 倍数关系：答案是大数本身
    const a = 3 + Math.floor(rng() * 10); // 3~12
    const k = 2 + Math.floor(rng() * 7); // 2~8
    const b = a * k;
    const traps: Trap[] = [];
    pushTextTrap(traps, a * b * 10, '倍数关系不用乘！大数本身就是最小公倍数', b * 10);
    pushTextTrap(traps, a * 10, '那是最大公因数，不是公倍数', b * 10);
    pushTextTrap(traps, b * 2 * 10, '是公倍数，但不是最小的', b * 10);
    return makeQuestion(text(`${a} 和 ${b}`), '最小公倍数是？', text(String(b)), traps);
  }
  if (kind < 0.6) {
    // 互质对：答案是乘积
    const [a, b] = pick(rng, COP_PAIRS_SMALL);
    const P = a * b;
    const traps: Trap[] = [];
    pushTextTrap(traps, Math.max(a, b) * 10, '互质的两个数，最小公倍数是它们的乘积', P * 10);
    pushTextTrap(traps, (a + b) * 10, '公倍数不是把两数相加', P * 10);
    pushTextTrap(traps, Math.min(a, b) * 10, `${Math.min(a, b)} 不是 ${Math.max(a, b)} 的倍数`, P * 10);
    fillTextTraps(traps, P * 10);
    return makeQuestion(text(`${a} 和 ${b}`), '最小公倍数是？', text(String(P)), traps);
  }
  // 有公因数对（主战场）：L = 乘积 ÷ 最大公因数
  const [a, b] = pick(rng, LCM_PAIRS);
  const g = gcd(a, b);
  const L = (a * b) / g;
  const traps: Trap[] = [];
  pushTextTrap(traps, a * b * 10, `${a * b} 是公倍数但不是最小的——它们有公因数 ${g}`, L * 10);
  pushTextTrap(traps, g * 10, '那是最大公因数！公倍数要比两个数都大', L * 10);
  pushTextTrap(traps, Math.max(a, b) * 10, `${Math.max(a, b)} 不是 ${Math.min(a, b)} 的倍数`, L * 10);
  return makeQuestion(text(`${a} 和 ${b}`), '最小公倍数是？', text(String(L)), traps);
};

const factorSenseSkill: Skill = {
  id: 'g5-ns-factor',
  title: '因数枚举',
  intro: [
    '考核点：因数识别与配对枚举（数感地基 1/5）',
    '因数成对出现：24 = 1×24 = 2×12 = 3×8 = 4×6，别漏 1 和它自己！',
    '这是最大公因数的前置功夫',
    '每题限时 6 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  numericKeypad: true,
  generators: [genFactorSense],
};

const divisSenseSkill: Skill = {
  id: 'g5-ns-divis',
  title: '整除特征',
  intro: [
    '考核点：不试除，一眼看出能不能整除（数感地基 2/5）',
    '3 和 9 看数字和；2、5、10 看个位；4 和 25 看末两位',
    '6 = 2 × 3，两个条件都要满足',
    '每题限时 5 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 5,
  questionCount: 10,
  numericKeypad: true,
  generators: [genDivisSense],
};

const primeSenseSkill: Skill = {
  id: 'g5-ns-prime',
  title: '质数与合数',
  intro: [
    '考核点：辨质数 + 分解质因数（数感地基 3/5）',
    '小心伪装者：51 = 3×17、57 = 3×19、91 = 7×13！',
    '分解质因数要分到每个数都是质数：12 = 2²×3，写成 2×6 不算完',
    '每题限时 6 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  supportsReview: false, // 分解质因数写法（2²×3）键盘输不了，只出选择题
  generators: [genPrimeSense],
};

const gcdSenseSkill: Skill = {
  id: 'g5-ns-gcd',
  title: '最大公因数',
  intro: [
    '考核点：最大公因数秒答（数感地基 4/5，约分的地基）',
    '倍数关系 → 较小数本身；互质 → 1',
    '其它情况：找公有因数里最大的一个',
    '每题限时 6 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  numericKeypad: true,
  generators: [genGcdSense],
};

const lcmSenseSkill: Skill = {
  id: 'g5-ns-lcm',
  title: '最小公倍数',
  intro: [
    '考核点：最小公倍数秒答（数感地基 5/5，通分的地基）',
    '倍数关系 → 较大数本身；互质 → 直接相乘',
    '有公因数 → 乘积 ÷ 最大公因数（例如 6 和 8：48 ÷ 2 = 24）',
    '每题限时 6 秒，答错扣分，连续答对有加成！',
  ],
  timeLimitSec: 6,
  questionCount: 10,
  numericKeypad: true,
  generators: [genLcmSense],
};

/* ---------------- 年级树（2024 沪教版五四制归类：原子能力归最早系统学习的年级） ---------------- */

export const GRADES: Grade[] = [
  {
    id: 'g5',
    title: '五年级 · 分数与小数',
    available: true,
    units: [
      { id: 'g5-num-sense', title: '5.0 数感地基 · 因数与倍数', skills: [factorSenseSkill, divisSenseSkill, primeSenseSkill, gcdSenseSkill, lcmSenseSkill] },
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
      { id: 'g6-1-1', title: '1.1 有理数的引入', skills: [oppositeAbsSkill, signCompareSkill, signedFracCmpSkill] },
      { id: 'g6-1-2', title: '1.2 有理数的加法与减法', skills: [signFlashSkill, signedFracFlashSkill, signedAddSkill, signedFracBasicSkill, signedFracAdvSkill] },
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
  // 局内去重：同一局题面不重复（2026-10-02 女儿实测约分题一局出现 3 次 12/18）。
  // 重复则消耗随机源重抽，最多重试 20 次（题池极小时保底放行）。
  // 与 iOS 版 Registry.swift 的 generateQuiz 一一对应，两边必须同步修改。
  const seen = new Set<string>();
  return Array.from({ length: total }, (_, i) => {
    const gen = skill.generators[i % skill.generators.length];
    let q = gen(rng);
    for (let retry = 0; retry < 20 && seen.has(exprKey(q.prompt)); retry++) q = gen(rng);
    seen.add(exprKey(q.prompt));
    return q;
  });
}
