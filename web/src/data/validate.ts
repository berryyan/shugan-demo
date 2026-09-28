/**
 * 题库质量校验（开发期工具，不打包进页面逻辑）。
 * 在浏览器控制台/ evaluate 中调用：import('/src/data/validate.ts').then(m => m.validateAll())
 */
import { exprKey, exprValue } from '@/core/types';
import { findSkill, generateQuiz } from '@/data/bank';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

export function validateSkill(skillId: string, seeds = 500) {
  const skill = findSkill(skillId);
  if (!skill) return { error: 'skill not found' };
  const bad: string[] = [];
  let total = 0;
  let reducible = 0;
  let equalCount = 0;
  for (let s = 0; s < seeds; s++) {
    for (const q of generateQuiz(skill, s)) {
      total++;
      // 铁律 1：任何文本不得出现 NaN / undefined / 空串 / 双小数点
      const flat = JSON.stringify([q.prompt, ...q.choices.map((c) => c.value)]);
      if (/NaN|undefined|\.\.|""/.test(flat)) {
        bad.push(`乱码文本 ${flat.slice(0, 80)}`);
        continue;
      }
      const keys = q.choices.map((c) => exprKey(c.value));
      const correct = q.choices.filter((c) => c.correct);
      // 铁律 2：恰好 1 个正确项、选项不重复、至少 3 个选项
      if (new Set(keys).size !== keys.length || correct.length !== 1 || q.choices.length < 3) {
        bad.push(`结构 ${exprKey(q.prompt)} -> ${keys.join(',')}`);
        continue;
      }
      const ans = correct[0].value;
      if (
        skillId === 'g6-rational-convert' ||
        skillId === 'g6-sense-rewrite' ||
        skillId === 'g6-sense-simplify'
      ) {
        if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`答案值不等 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
        if (ans.kind === 'frac' && gcd(Number(ans.n), Number(ans.d)) !== 1) reducible++;
      }
      // 分数运算四题库：答案值必须等于题面运算结果，且答案必须最简（分数/带分数部分互质）
      if (skillId.startsWith('g6-frac-')) {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`运算答案错 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
        if (ans.kind === 'frac' && gcd(Number(ans.n), Number(ans.d)) !== 1) reducible++;
        if (ans.kind === 'mixed' && gcd(Number(ans.n), Number(ans.d)) !== 1) reducible++;
        // 运算题必须是 1 正确 + 3 干扰的完整 4 选项
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 正负数加减：答案值等于题面运算结果，4 选项完整
      if (skillId === 'g6-signed-add') {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`正负加减答案错 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 符号快闪：正确选项标签必须与题面结果符号一致
      if (skillId === 'g6-sign-flash') {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else {
          const v = exprValue(q.prompt);
          const want = v > 0 ? '正数' : v < 0 ? '负数' : '等于 0';
          if (exprKey(ans) !== want) bad.push(`符号判错 ${exprKey(q.prompt)} v=${v} ans=${exprKey(ans)}`);
          if (v === 0) equalCount++;
        }
      }
      if (skillId === 'g6-sense-compare' && q.prompt.kind === 'vs') {
        const vL = exprValue(q.prompt.left);
        const vR = exprValue(q.prompt.right);
        const isEq = Math.abs(vL - vR) < 1e-9;
        if (isEq) {
          equalCount++;
          if (exprKey(ans) !== '一样大') bad.push(`等值判错 ${exprKey(q.prompt)}`);
        } else if (Math.abs(exprValue(ans) - Math.max(vL, vR)) > 1e-9) {
          bad.push(`比较判错 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
      }
      // 通分快闪：题面是"和"两项；通分后的分数答案分母必须等于两题面分母的最小公倍数，
      // 且值与所问的那一项相等（答案故意不约分，不做最简检查）；最小公分母答案数值等于 lcm
      if (skillId === 'g6-sense-lcd') {
        if (q.prompt.kind !== 'op' || q.prompt.terms.length !== 2) {
          bad.push(`题面结构错 ${exprKey(q.prompt)}`);
        } else {
          const t1 = q.prompt.terms[0];
          const t2 = q.prompt.terms[1];
          const L = lcm(Number(t1.kind === 'frac' ? t1.d : 1), Number(t2.kind === 'frac' ? t2.d : 1));
          if (ans.kind === 'frac') {
            if (Number(ans.d) !== L) bad.push(`通分答案分母非lcm ${exprKey(q.prompt)} ans=${exprKey(ans)} L=${L}`);
            const av = exprValue(ans);
            if (Math.abs(av - exprValue(t1)) > 1e-9 && Math.abs(av - exprValue(t2)) > 1e-9) {
              bad.push(`通分答案值不等任一项 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
            }
          } else if (Math.abs(exprValue(ans) - L) > 1e-9) {
            bad.push(`最小公分母错 ${exprKey(q.prompt)} ans=${exprKey(ans)} L=${L}`);
          }
          if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
        }
      }
      // 交叉约分：答案是运算式，值必须等于题面乘积；4 选项完整
      if (skillId === 'g6-sense-crosscancel') {
        if (ans.kind !== 'op') bad.push(`答案非运算式 ${exprKey(q.prompt)}`);
        else if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`约分后值改变 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 倒数快闪：答案 × 题面 === 1
      if (skillId === 'g6-sense-reciprocal') {
        const prod = exprValue(ans) * exprValue(q.prompt);
        if (Math.abs(prod - 1) > 1e-9) {
          bad.push(`非倒数 ${exprKey(q.prompt)} ans=${exprKey(ans)} prod=${prod}`);
        }
        if (q.choices.length < 3) bad.push(`选项不足3个 ${exprKey(q.prompt)}`);
      }
      // 相反数与绝对值：按 requirement 判断
      if (skillId === 'g6-sign-opposite' && q.prompt.kind === 'text') {
        const av = exprValue(ans);
        const req = q.requirement ?? '';
        let want: number | null = null;
        const raw = q.prompt.text;
        if (req === '写出它的相反数') {
          const pv = parseFloat(raw);
          if (!Number.isNaN(pv)) want = -pv;
        } else {
          const m = raw.match(/^-\(([-\d.]+)\)$/);
          const ma = raw.match(/^\|([-\d.]+)\|$/);
          const mb = raw.match(/^-\|([-\d.]+)\|$/);
          if (m) want = -parseFloat(m[1]);
          else if (ma) want = Math.abs(parseFloat(ma[1]));
          else if (mb) want = -Math.abs(parseFloat(mb[1]));
        }
        if (want === null || Math.abs(av - want) > 1e-9) {
          bad.push(`相反数/绝对值错 ${exprKey(q.prompt)} req=${req} ans=${exprKey(ans)} want=${want}`);
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 正负数比大小：复用 compare 判定（含负数）
      if (skillId === 'g6-sign-compare' && q.prompt.kind === 'vs') {
        const vL = exprValue(q.prompt.left);
        const vR = exprValue(q.prompt.right);
        const isEq = Math.abs(vL - vR) < 1e-9;
        if (isEq) {
          equalCount++;
          if (exprKey(ans) !== '一样大') bad.push(`等值判错 ${exprKey(q.prompt)}`);
        } else if (Math.abs(exprValue(ans) - Math.max(vL, vR)) > 1e-9) {
          bad.push(`负数比较判错 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
      }
      // 乘除符号快闪：结果永远非零，符号与答案标签一致
      if (skillId === 'g6-sign-flash-mul') {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else {
          const v = exprValue(q.prompt);
          if (v === 0) bad.push(`出现0结果 ${exprKey(q.prompt)}`);
          const want = v > 0 ? '正数' : '负数';
          if (exprKey(ans) !== want) bad.push(`乘除符号判错 ${exprKey(q.prompt)} v=${v} ans=${exprKey(ans)}`);
        }
        if (q.choices.length !== 3) bad.push(`选项非3个 ${exprKey(q.prompt)}`);
      }
      // 正负数乘除：答案值等于题面运算结果，4 选项完整
      if (skillId === 'g6-signed-mul') {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`正负乘除答案错 ${exprKey(q.prompt)} ans=${exprKey(ans)}`);
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 乘方速记：解析题面文本（n² / n³ / (-a)² / -a² / (-a)³）核对答案
      if (skillId === 'g6-power-flash' && q.prompt.kind === 'text') {
        const p = q.prompt.text;
        let want: number | null = null;
        let m = p.match(/^\((-?\d+)\)([²³])$/);
        if (m) {
          const base = Number(m[1]);
          want = m[2] === '²' ? base * base : base * base * base;
        } else if ((m = p.match(/^(-?\d+)([²³])$/))) {
          const base = Number(m[1]);
          const pow = m[2] === '²' ? base * base : base * base * base;
          // -a² = -(a²)：负号在幂外面；a² 普通幂
          want = p.startsWith('-') ? -pow : pow;
        }
        if (want === null || Math.abs(exprValue(ans) - want) > 1e-9) {
          bad.push(`乘方答案错 ${p} ans=${exprKey(ans)} want=${want}`);
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${p}`);
      }
      // 分数+小数混合四则：答案值等于题面运算结果，分数类答案必须最简，4 选项完整
      if (skillId === 'g6-frac-dec-mix') {
        if (q.prompt.kind !== 'op') bad.push(`题面非运算式 ${exprKey(q.prompt)}`);
        else if (Math.abs(exprValue(ans) - exprValue(q.prompt)) > 1e-9) {
          bad.push(`混合运算答案错 ${exprKey(q.prompt)} ans=${exprKey(ans)} pv=${exprValue(q.prompt)} av=${exprValue(ans)}`);
        }
        if (ans.kind === 'frac' && gcd(Number(ans.n), Number(ans.d)) !== 1) reducible++;
        if (ans.kind === 'mixed' && gcd(Number(ans.n), Number(ans.d)) !== 1) reducible++;
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${exprKey(q.prompt)}`);
      }
      // 运算顺序：正确答案步骤必须是题面中的真实相邻步骤，选项 ≥3
      if (skillId === 'g6-op-order' && q.prompt.kind === 'text') {
        if (ans.kind !== 'text' || !q.prompt.text.includes(ans.text)) {
          bad.push(`步骤不在题面中 ${q.prompt.text} ans=${exprKey(ans)}`);
        }
        if (q.choices.length < 3) bad.push(`选项不足3个 ${q.prompt.text}`);
      }
      // 凑整巧算：第一步题 → 答案是题面中某两个数的乘法对且积为整十整百；求值题 → 数值等于题面运算结果
      if (skillId === 'g6-op-laws' && q.prompt.kind === 'text') {
        if ((q.requirement ?? '').includes('第一步')) {
          const parts = ans.kind === 'text' ? ans.text.split(' × ') : [];
          const prod = parts.length === 2 ? parseFloat(parts[0]) * parseFloat(parts[1]) : NaN;
          const ok =
            parts.length === 2 &&
            parts.every((p) => (q.prompt as { text: string }).text.includes(p)) &&
            [1, 10, 100, 1000].includes(prod);
          if (!ok) bad.push(`巧算第一步不对 ${q.prompt.text} ans=${exprKey(ans)}`);
        } else {
          const js = q.prompt.text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
          let v = NaN;
          try {
            v = Function(`"use strict"; return (${js});`)() as number;
          } catch {
            bad.push(`题面无法求值 ${q.prompt.text}`);
          }
          if (!Number.isNaN(v) && Math.abs(exprValue(ans) - v) > 1e-9) {
            bad.push(`凑整求值错 ${q.prompt.text} ans=${exprKey(ans)} want=${v}`);
          }
        }
        if (q.choices.length !== 4) bad.push(`选项不足4个 ${q.prompt.text}`);
      }
    }
  }
  return { total, badCount: bad.length, badSample: bad.slice(0, 3), reducible, equalCount };
}

export function validateAll() {
  return {
    convert: validateSkill('g6-rational-convert'),
    rewrite: validateSkill('g6-sense-rewrite'),
    simplify: validateSkill('g6-sense-simplify'),
    compare: validateSkill('g6-sense-compare'),
    fracAdd: validateSkill('g6-frac-add'),
    fracSub: validateSkill('g6-frac-sub'),
    fracMul: validateSkill('g6-frac-mul'),
    fracDiv: validateSkill('g6-frac-div'),
    signFlash: validateSkill('g6-sign-flash'),
    signedAdd: validateSkill('g6-signed-add'),
    lcd: validateSkill('g6-sense-lcd'),
    crossCancel: validateSkill('g6-sense-crosscancel'),
    reciprocal: validateSkill('g6-sense-reciprocal'),
    oppositeAbs: validateSkill('g6-sign-opposite'),
    signCompare: validateSkill('g6-sign-compare'),
    signFlashMul: validateSkill('g6-sign-flash-mul'),
    signedMul: validateSkill('g6-signed-mul'),
    powerFlash: validateSkill('g6-power-flash'),
    fracDecMix: validateSkill('g6-frac-dec-mix'),
    opOrder: validateSkill('g6-op-order'),
    opLaws: validateSkill('g6-op-laws'),
  };
}
