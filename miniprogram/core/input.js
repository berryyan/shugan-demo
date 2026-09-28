/**
 * 复习模式填空输入解析（小程序版，与网页版规则一致）：
 * 支持 整数 / 小数 / 分数(3/4) / 带分数(1 3/4，空格分隔)，可带负号。
 * 返回 { value, form, reducible } 或 null（格式不合法）。
 */

function gcdNum(a, b) {
  return b ? gcdNum(b, a % b) : a;
}

function parseAnswerInput(raw) {
  const s = raw.trim();
  if (!s || s === '-') return null;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const sign = neg ? -1 : 1;
  if (!body) return null;
  // 整数或小数
  if (/^\d+(\.\d+)?$/.test(body)) return { value: sign * parseFloat(body), form: body.includes('.') ? 'dec' : 'int', reducible: false };
  // 分数 3/4
  let m = body.match(/^(\d+)\/(\d+)$/);
  if (m && Number(m[2]) !== 0) {
    const n = Number(m[1]);
    const d = Number(m[2]);
    return { value: (sign * n) / d, form: 'frac', reducible: gcdNum(n, d) !== 1 };
  }
  // 带分数 1 3/4
  m = body.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m && Number(m[3]) !== 0) {
    const n = Number(m[2]);
    const d = Number(m[3]);
    return { value: sign * (Number(m[1]) + n / d), form: 'mixed', reducible: gcdNum(n, d) !== 1 };
  }
  return null;
}

/**
 * 形式校验：数值相等后，还要满足题目要求的形式（最简分数/带分数/小数）。
 * acceptImproper：带分数答案也接受最简假分数（四则组合题库放宽）
 * allowUnreduced：通分题库跳过约分检查（答案故意保留同分母）
 * 返回 null = 通过，否则返回提示文案
 */
function formError(parsed, correct, acceptImproper, allowUnreduced) {
  if (correct.kind === 'frac') {
    if (parsed.form !== 'frac') return '数值对了，但要写成分数形式';
    if (parsed.reducible && !allowUnreduced) return '数值对了，但还没约到最简';
  }
  if (correct.kind === 'mixed') {
    if (acceptImproper && parsed.form === 'frac') {
      if (parsed.reducible) return '数值对了，但还没约到最简';
      return null;
    }
    if (parsed.form !== 'mixed') return '数值对了，但要写成带分数形式';
    if (parsed.reducible) return '数值对了，但分数部分还没约到最简';
  }
  return null;
}

/**
 * 输入串 → 显示 token（复刻网页版 InputPreview 的分数槽位渲染）：
 * - "1 1/2" → [text '1'][frac n/d]，带分数按空格键后立即出现分数骨架
 * - "3/4"   → [frac n/d]
 * - 其余    → [text 原样]
 * 空槽位 n/d 为 null，由 WXML 渲染幽灵框占位（每步按键都有视觉反馈）。
 */
function inputToTokens(s) {
  if (!s) return [];
  if (s.includes(' ')) {
    const sp = s.indexOf(' ');
    const w = s.slice(0, sp);
    const rest = s.slice(sp + 1);
    const sl = rest.indexOf('/');
    const n = sl >= 0 ? rest.slice(0, sl) : rest;
    const d = sl >= 0 ? rest.slice(sl + 1) : null;
    return [
      { t: 'text', v: w },
      { t: 'frac', n: n || null, d: d === null ? null : d || null },
    ];
  }
  if (s.includes('/')) {
    const sl = s.indexOf('/');
    const n = s.slice(0, sl);
    const d = s.slice(sl + 1);
    return [{ t: 'frac', n: n || null, d: d || null }];
  }
  return [{ t: 'text', v: s }];
}

module.exports = { parseAnswerInput, formError, inputToTokens };
