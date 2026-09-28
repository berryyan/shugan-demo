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

// src/mp-entry.ts
var mp_entry_exports = {};
__export(mp_entry_exports, {
  GRADES: () => GRADES,
  exprKey: () => exprKey,
  exprValue: () => exprValue,
  findSkill: () => findSkill,
  generateQuiz: () => generateQuiz,
  modeParams: () => modeParams,
  mulberry32: () => mulberry32
});
module.exports = __toCommonJS(mp_entry_exports);

// src/core/types.ts
function exprKey(e) {
  return e.kind === "text" ? e.text : JSON.stringify(e);
}
function exprValue(e) {
  switch (e.kind) {
    case "text":
      return parseFloat(e.text);
    case "frac":
      return Number(e.n) / Number(e.d);
    case "mixed": {
      const w = Number(e.whole);
      return Math.sign(w || 1) * (Math.abs(w) + Number(e.n) / Number(e.d));
    }
    case "op": {
      const vals = e.terms.map(exprValue);
      switch (e.op) {
        case "+":
          return vals.reduce((a, b) => a + b, 0);
        case "-":
          return vals.slice(1).reduce((a, b) => a - b, vals[0]);
        case "\xD7":
          return vals.reduce((a, b) => a * b, 1);
        case "\xF7":
          return vals.slice(1).reduce((a, b) => a / b, vals[0]);
        case "\u548C":
          return NaN;
      }
      return NaN;
    }
    case "vs":
      return NaN;
  }
}
function modeParams(skill, mode) {
  if (mode === "review")
    return { count: 20, timeLimitSec: Math.round(skill.timeLimitSec * 1.5) };
  if (mode === "advanced")
    return { count: skill.questionCount, timeLimitSec: Math.max(4, Math.round(skill.timeLimitSec * 0.6)) };
  return { count: skill.questionCount, timeLimitSec: skill.timeLimitSec };
}

// src/data/bank.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
var qid = 0;
function makeQuestion(prompt, requirement, correct, traps) {
  const seen = /* @__PURE__ */ new Set([exprKey(correct)]);
  const cleanTraps = traps.filter((t) => {
    const k = exprKey(t.value);
    if (seen.has(k))
      return false;
    seen.add(k);
    return true;
  });
  const kept = shuffle(rngGlobal, cleanTraps).slice(0, Math.min(cleanTraps.length, 3));
  const choices = shuffle(rngGlobal, [
    { id: "c", value: correct, correct: true },
    ...kept.map((t, i) => ({ id: `t${i}`, value: t.value, correct: false, trap: t.trap }))
  ]);
  return { id: `q${++qid}`, prompt, requirement, choices };
}
var rngGlobal = Math.random;
var frac = (n, d) => ({
  kind: "frac",
  n: String(n),
  d: String(d)
});
var text = (t) => ({ kind: "text", text: t });
var mixed = (w, n, d) => ({
  kind: "mixed",
  whole: String(w),
  n: String(n),
  d: String(d)
});
var DENOMINATORS = [2, 4, 5, 8, 10];
var gcd = (a, b) => b ? gcd(b, a % b) : a;
function coprimeNumerators(d) {
  const list = [];
  for (let n = 1; n < d; n++)
    if (gcd(n, d) === 1)
      list.push(n);
  return list;
}
function randomNumerator(rng, d, exclude) {
  const candidates = coprimeNumerators(d).filter((n) => n !== exclude);
  return pick(rng, candidates);
}
function randomWhole(rng) {
  return rng() < 0.5 ? 1 + Math.floor(rng() * 10) : 11 + Math.floor(rng() * 90);
}
function fracToDecimalText(n, d, whole = 0) {
  if (1e3 % d !== 0)
    return "";
  const scaled = whole * 1e3 + n * (1e3 / d);
  const s = String(scaled).padStart(4, "0");
  const out = `${s.slice(0, -3)}.${s.slice(-3)}`;
  return out.replace(/0+$/, "").replace(/\.$/, "");
}
function decimalToUnreducedFrac(decText) {
  const [intPart, fracDigits] = decText.split(".");
  const denominator = Math.pow(10, fracDigits.length);
  const numerator = Number(intPart) * denominator + Number(fracDigits);
  return frac(numerator, denominator);
}
function altNumerators(d, n) {
  return coprimeNumerators(d).filter((x) => x !== n);
}
function altDenominators(d, n) {
  return DENOMINATORS.filter((x) => x !== d && n < x && gcd(n, x) === 1);
}
var genDecimalToFraction = (rng) => {
  rngGlobal = rng;
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const dec = fracToDecimalText(n, d);
  const traps = [
    // 误区 1：未约分——数值相等但不是最简（如 0.125 → 125/1000）
    { value: decimalToUnreducedFrac(dec), trap: "\u6570\u503C\u76F8\u7B49\u4F46\u6CA1\u6709\u7EA6\u6210\u6700\u7B80\u5206\u6570\uFF0C\u8FD8\u8981\u7EE7\u7EED\u7EA6\u5206" },
    // 误区 2：分子分母颠倒（如 0.75 → 4/3）
    { value: frac(d, n), trap: "\u5206\u5B50\u5206\u6BCD\u5199\u53CD\u4E86\uFF0C\u771F\u5206\u6570\u7684\u503C\u5C0F\u4E8E 1" }
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: frac(pick(rng, n2s), d), trap: "\u5206\u5B50\u770B\u9519\u4E86\uFF0C\u518D\u4ED4\u7EC6\u6570\u4E00\u6570\u5C0F\u6570\u90E8\u5206\u7684\u503C" });
  const d2s = altDenominators(d, n);
  if (d2s.length)
    traps.push({ value: frac(n, pick(rng, d2s)), trap: "\u5206\u6BCD\u770B\u9519\u4E86" });
  return makeQuestion(text(dec), "\u7528\u6700\u7B80\u5206\u6570\u8868\u793A", frac(n, d), traps);
};
var genFractionToDecimal = (rng) => {
  rngGlobal = rng;
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const ans = fracToDecimalText(n, d);
  const traps = [
    // 误区 1：数位拼接——把 3/8 直接写成 0.38
    { value: text(`0.${n}${d}`), trap: "\u4E0D\u80FD\u628A\u5206\u5B50\u5206\u6BCD\u76F4\u63A5\u62FC\u5728\u5C0F\u6570\u70B9\u540E\uFF0C\u8981\u7B97\u51FA\u5206\u6570\u7684\u503C" },
    // 误区 2：小数点错位（0.625 → 0.0625）
    { value: text(`0.0${ans.slice(2)}`), trap: "\u5C0F\u6570\u70B9\u4F4D\u7F6E\u9519\u4E86\uFF0C\u6CE8\u610F\u8FD9\u4E2A\u5206\u6570\u4E0D\u5230 1 \u4F46\u4E5F\u6CA1\u90A3\u4E48\u5C0F" }
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: text(fracToDecimalText(pick(rng, n2s), d)), trap: "\u5206\u5B50\u770B\u9519\u4E86" });
  const d2s = altDenominators(d, n);
  if (d2s.length)
    traps.push({ value: text(fracToDecimalText(n, pick(rng, d2s))), trap: "\u5206\u6BCD\u770B\u9519\u4E86" });
  return makeQuestion(frac(n, d), "\u7528\u5C0F\u6570\u8868\u793A", text(ans), traps);
};
var genMixedDecimalToFraction = (rng) => {
  rngGlobal = rng;
  const w = randomWhole(rng);
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const dec = fracToDecimalText(n, d, w);
  const fracDigits = dec.split(".")[1];
  const denominator = Math.pow(10, fracDigits.length);
  const unreducedN = Number(fracDigits);
  const traps = [
    // 误区 1：分数部分未约分（如 1.75 → 1又75/100）
    { value: mixed(w, unreducedN, denominator), trap: "\u5206\u6570\u90E8\u5206\u6570\u503C\u76F8\u7B49\u4F46\u6CA1\u6709\u7EA6\u6210\u6700\u7B80\uFF0C\u8FD8\u8981\u7EE7\u7EED\u7EA6\u5206" },
    // 误区 2：写成相等的假分数——数值对但不是题目要求的形式
    { value: frac(w * d + n, d), trap: "\u8FD9\u662F\u76F8\u7B49\u7684\u5047\u5206\u6570\uFF0C\u4F46\u9898\u76EE\u8981\u6C42\u5E26\u5206\u6570\u5F62\u5F0F" },
    // 误区 3：整数部分看错
    { value: mixed(w + 1, n, d), trap: "\u6574\u6570\u90E8\u5206\u770B\u9519\u4E86" }
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: mixed(w, pick(rng, n2s), d), trap: "\u5C0F\u6570\u90E8\u5206\u7684\u5206\u5B50\u770B\u9519\u4E86" });
  return makeQuestion(text(dec), "\u7528\u5E26\u5206\u6570\u8868\u793A\uFF08\u5206\u6570\u90E8\u5206\u6700\u7B80\uFF09", mixed(w, n, d), traps);
};
var genMixedFractionToDecimal = (rng) => {
  rngGlobal = rng;
  const w = randomWhole(rng);
  const d = pick(rng, DENOMINATORS);
  const n = randomNumerator(rng, d);
  const traps = [
    // 误区 1：数位拼接——把 1又3/4 直接写成 1.34
    { value: text(`${w}.${n}${d}`), trap: "\u4E0D\u80FD\u628A\u5206\u5B50\u5206\u6BCD\u76F4\u63A5\u62FC\u5728\u5C0F\u6570\u70B9\u540E\uFF0C\u8981\u5148\u7B97\u5206\u6570\u90E8\u5206\u7684\u503C" },
    // 误区 2：只取了分数部分，丢了整数
    { value: text(fracToDecimalText(n, d)), trap: "\u6F0F\u6389\u4E86\u6574\u6570\u90E8\u5206" },
    // 误区 3：整数部分看错
    { value: text(fracToDecimalText(n, d, w + 1)), trap: "\u6574\u6570\u90E8\u5206\u770B\u9519\u4E86" }
  ];
  const n2s = altNumerators(d, n);
  if (n2s.length)
    traps.push({ value: text(fracToDecimalText(pick(rng, n2s), d, w)), trap: "\u5206\u5B50\u770B\u9519\u4E86" });
  return makeQuestion(mixed(w, n, d), "\u7528\u5C0F\u6570\u8868\u793A", text(fracToDecimalText(n, d, w)), traps);
};
var rationalConvertSkill = {
  id: "g6-rational-convert",
  title: "\u5C0F\u6570 \u21C4 \u5206\u6570\u8F6C\u6362",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5C0F\u6570\u4E0E\u5206\u6570\u53CC\u5411\u8F6C\u6362\uFF0C\u7EAF\u5C0F\u6570 / \u7EAF\u5206\u6570 / \u5E26\u6574\u6570\u5C0F\u6570 / \u5E26\u5206\u6570\u56DB\u7C7B\u5747\u5300\u51FA\u9898",
    "\u5206\u6BCD\u56F4\u7ED5\u5E38\u8003\u7684 2\u30014\u30015\u30018\u300110\uFF0C\u5206\u5B50\u968F\u673A\uFF08\u4FDD\u8BC1\u6700\u7B80\uFF09\uFF0C\u5E26\u6574\u6570\u9898\u6574\u6570\u90E8\u5206 1~100",
    "\u5C0F\u6570 \u2192 \u5206\u6570\uFF1A\u5199\u6210\u6700\u7B80\u5206\u6570\u6216\u5E26\u5206\u6570\uFF08\u4F8B\u5982 0.125 = \u215B\uFF0C1.75 = 1\xBE\uFF09",
    "\u6BCF\u9898\u9650\u65F6 10 \u79D2\uFF0C\u7B54\u9519\u6263\u5206\uFF0C\u8FDE\u7EED\u7B54\u5BF9\u6709\u52A0\u6210\u2014\u2014\u4E0D\u8981\u778E\u731C\uFF01"
  ],
  timeLimitSec: 10,
  questionCount: 10,
  // 四个类别轮转，一局内均匀分配
  generators: [
    genDecimalToFraction,
    genFractionToDecimal,
    genMixedDecimalToFraction,
    genMixedFractionToDecimal
  ]
};
var REWRITE_DENOMINATORS = [2, 3, 4, 5, 6, 8];
function randomRewriteParams(rng) {
  const d = pick(rng, REWRITE_DENOMINATORS);
  const r = randomNumerator(rng, d);
  const w = 1 + Math.floor(rng() * 6);
  return { d, r, w, n: w * d + r };
}
var genImproperToMixed = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  const traps = [
    { value: mixed(w + 1, r, d), trap: "\u5546\u7B97\u5927\u4E86\uFF0C\u5206\u4E00\u5206\u6570\u91CC\u9762\u6709\u51E0\u4E2A\u5206\u6BCD" },
    { value: frac(r, d), trap: "\u6F0F\u6389\u4E86\u6574\u6570\u90E8\u5206" },
    { value: frac(d, n), trap: "\u5206\u5B50\u5206\u6BCD\u5199\u53CD\u4E86\uFF0C\u5047\u5206\u6570\u7684\u503C\u5927\u4E8E 1" }
  ];
  const r2s = altNumerators(d, r);
  if (r2s.length)
    traps.push({ value: mixed(w, pick(rng, r2s), d), trap: "\u4F59\u6570\u7B97\u9519\u4E86\uFF1A\u5546 \xD7 \u5206\u6BCD + \u4F59\u6570 = \u5206\u5B50" });
  if (w >= 2)
    traps.push({ value: mixed(w - 1, r, d), trap: "\u5546\u7B97\u5C0F\u4E86\uFF0C\u5269\u4E0B\u7684\u90E8\u5206\u8FD8\u591F\u518D\u5206\u4E00\u4EFD" });
  return makeQuestion(frac(n, d), "\u7528\u5E26\u5206\u6570\u8868\u793A", mixed(w, r, d), traps);
};
var genMixedToImproper = (rng) => {
  rngGlobal = rng;
  const { d, r, w, n } = randomRewriteParams(rng);
  const traps = [
    { value: frac(w + r, d), trap: "\u6574\u6570\u90E8\u5206\u8981\u5148\u4E58\u5206\u6BCD\u518D\u52A0\u5206\u5B50\uFF0C\u4E0D\u662F\u76F4\u63A5\u76F8\u52A0" },
    { value: frac(r, d), trap: "\u6F0F\u6389\u4E86\u6574\u6570\u90E8\u5206" },
    { value: frac((w + 1) * d + r, d), trap: "\u6574\u6570\u90E8\u5206\u770B\u9519\u4E86\uFF0C\u591A\u6570\u4E86\u4E00\u4EFD" }
  ];
  const r2s = altNumerators(d, r);
  if (r2s.length)
    traps.push({ value: frac(w * d + pick(rng, r2s), d), trap: "\u5206\u5B50\u7B97\u9519\u4E86\uFF1A\u6574\u6570 \xD7 \u5206\u6BCD + \u539F\u5206\u5B50" });
  return makeQuestion(mixed(w, r, d), "\u7528\u5047\u5206\u6570\u8868\u793A", frac(n, d), traps);
};
var genSimplify = (rng) => {
  rngGlobal = rng;
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
  const partials = [2, 3, 5].filter((f) => k % f === 0 && k / f > 1).map((f) => ({
    value: frac(n * (k / f), d * (k / f)),
    trap: "\u6CA1\u7EA6\u5E72\u51C0\uFF0C\u8981\u7EA6\u5230\u5206\u5B50\u5206\u6BCD\u4E92\u8D28\u4E3A\u6B62"
  }));
  const traps = [
    ...partials,
    { value: frac(n, d * k), trap: "\u53EA\u7EA6\u4E86\u5206\u6BCD\uFF0C\u5206\u5B50\u4E5F\u8981\u9664\u4EE5\u540C\u4E00\u4E2A\u6570" },
    { value: frac(n * k, d), trap: "\u53EA\u7EA6\u4E86\u5206\u5B50\uFF0C\u5206\u6BCD\u4E5F\u8981\u9664\u4EE5\u540C\u4E00\u4E2A\u6570" },
    { value: frac(n * k - 1, d * k - 1), trap: "\u5206\u5B50\u5206\u6BCD\u8981\u9664\u4EE5\u540C\u4E00\u4E2A\u6570\uFF0C\u4E0D\u662F\u51CF\u53BB\u540C\u4E00\u4E2A\u6570" }
  ];
  return makeQuestion(frac(n * k, d * k), "\u7EA6\u6210\u6700\u7B80\u5206\u6570", frac(n, d), traps);
};
var CMP_DENOMINATORS = [2, 3, 4, 5, 8, 10];
var DECIMAL_OK = [2, 4, 5, 8, 10];
var genCompare = (rng) => {
  rngGlobal = rng;
  const equal = rng() < 0.2;
  const d1 = pick(rng, CMP_DENOMINATORS);
  const n1 = randomNumerator(rng, d1);
  const left = frac(n1, d1);
  let right;
  if (equal) {
    right = DECIMAL_OK.includes(d1) ? text(fracToDecimalText(n1, d1)) : frac(n1 * 2, d1 * 2);
  } else {
    const crossForm = rng() < 0.4;
    for (let tries = 0; tries < 50; tries++) {
      const d2 = pick(rng, CMP_DENOMINATORS);
      const n2 = randomNumerator(rng, d2);
      if (d1 === d2 && n1 === n2)
        continue;
      const v1 = n1 / d1;
      const v2 = n2 / d2;
      if (v1 === v2)
        continue;
      if (Math.abs(v1 - v2) > 0.3)
        continue;
      right = crossForm && DECIMAL_OK.includes(d2) ? text(fracToDecimalText(n2, d2)) : frac(n2, d2);
      break;
    }
    right ??= frac(randomNumerator(rng, 8, n1 === 1 ? 1 : void 0), 8);
  }
  const vL = n1 / d1;
  const vR = exprValue(right);
  const isEqual = Math.abs(vL - vR) < 1e-9;
  const sameText = text("\u4E00\u6837\u5927");
  const prompt = { kind: "vs", left, right };
  if (isEqual) {
    const traps2 = [
      { value: left, trap: "\u4E24\u8FB9\u5176\u5B9E\u76F8\u7B49" },
      { value: right, trap: "\u4E24\u8FB9\u5176\u5B9E\u76F8\u7B49" }
    ];
    return makeQuestion(prompt, "\u54EA\u8FB9\u66F4\u5927\uFF1F", sameText, traps2);
  }
  const bigger = vL > vR ? left : right;
  const smaller = vL > vR ? right : left;
  const traps = [
    { value: smaller, trap: "\u8FD9\u4E2A\u66F4\u5C0F\uFF0C\u53EF\u4EE5\u5728\u5FC3\u91CC\u5148\u6362\u6210\u540C\u4E00\u79CD\u5F62\u5F0F\u518D\u6BD4" },
    { value: sameText, trap: "\u4E24\u8FB9\u4E0D\u76F8\u7B49\uFF0C\u5DEE\u5F97\u4E0D\u591A\uFF0C\u4ED4\u7EC6\u6BD4" }
  ];
  return makeQuestion(prompt, "\u54EA\u8FB9\u66F4\u5927\uFF1F", bigger, traps);
};
var rewriteSkill = {
  id: "g6-sense-rewrite",
  title: "\u5206\u6570\u6539\u5199",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5047\u5206\u6570 \u21C4 \u5E26\u5206\u6570\u4E92\u5316\uFF08\u6570\u611F\u539F\u5B50\u80FD\u529B A2\uFF09",
    "\u5047\u5206\u6570 \u2192 \u5E26\u5206\u6570\uFF1A\u5206\u5B50 \xF7 \u5206\u6BCD\uFF0C\u5546\u662F\u6574\u6570\u90E8\u5206\u3001\u4F59\u6570\u662F\u5206\u5B50\uFF08\u4F8B\u5982 7/6 = 1\u2159\uFF09",
    "\u5E26\u5206\u6570 \u2192 \u5047\u5206\u6570\uFF1A\u6574\u6570 \xD7 \u5206\u6BCD + \u5206\u5B50\uFF08\u4F8B\u5982 2\u2153 = 7/3\uFF09",
    "\u6BCF\u9898\u9650\u65F6 10 \u79D2\uFF0C\u7B54\u9519\u6263\u5206\uFF0C\u8FDE\u7EED\u7B54\u5BF9\u6709\u52A0\u6210\uFF01"
  ],
  timeLimitSec: 10,
  questionCount: 10,
  generators: [genImproperToMixed, genMixedToImproper]
};
var simplifySkill = {
  id: "g6-sense-simplify",
  title: "\u7EA6\u5206\u8BAD\u7EC3",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u628A\u5206\u6570\u7EA6\u6210\u6700\u7B80\u5F62\u5F0F\uFF08\u6570\u611F\u539F\u5B50\u80FD\u529B A3\uFF09",
    "\u5206\u5B50\u5206\u6BCD\u540C\u65F6\u9664\u4EE5\u516C\u56E0\u6570\uFF0C\u4E00\u76F4\u7EA6\u5230\u4E92\u8D28\u4E3A\u6B62\uFF08\u4F8B\u5982 25/75 = 1/3\uFF09",
    '\u5C0F\u5FC3"\u6CA1\u7EA6\u5E72\u51C0"\u7684\u9009\u9879\u2014\u2014\u7EA6\u4E86\u4E00\u534A\u4E0D\u7B97\u5BF9\uFF01',
    "\u6BCF\u9898\u9650\u65F6 10 \u79D2\uFF0C\u7B54\u9519\u6263\u5206\uFF0C\u8FDE\u7EED\u7B54\u5BF9\u6709\u52A0\u6210\uFF01"
  ],
  timeLimitSec: 10,
  questionCount: 10,
  generators: [genSimplify]
};
var compareSkill = {
  id: "g6-sense-compare",
  title: "\u5927\u5C0F\u6BD4\u8F83",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u4E0D\u786C\u7B97\uFF0C\u51ED\u6570\u611F\u6BD4\u8F83\u5206\u6570/\u5C0F\u6570\u5927\u5C0F\uFF08\u6570\u611F\u539F\u5B50\u80FD\u529B B1\uFF09",
    "\u6280\u5DE7\uFF1A\u5728\u5FC3\u91CC\u628A\u4E24\u8FB9\u6362\u6210\u540C\u4E00\u79CD\u5F62\u5F0F\u518D\u6BD4\uFF08\u4F8B\u5982 \u215D = 0.625 > 0.6\uFF09",
    "\u7EA6\u4E24\u6210\u9898\u76EE\u4E24\u8FB9\u5176\u5B9E\u76F8\u7B49\u2014\u2014\u4E0D\u8981\u88AB\u4E0D\u540C\u5199\u6CD5\u9A97\u4E86\uFF01",
    "\u6BCF\u9898\u9650\u65F6 8 \u79D2\uFF0C\u7B54\u9519\u6263\u5206\uFF0C\u8FDE\u7EED\u7B54\u5BF9\u6709\u52A0\u6210\uFF01"
  ],
  timeLimitSec: 8,
  questionCount: 10,
  // 三选一题型不适合填空，复习模式不出
  supportsReview: false,
  generators: [genCompare]
};
var ARITH_DENOMS = [2, 3, 4, 5, 6, 8];
var MULTIPLE_PAIRS = [[2, 4], [2, 6], [3, 6], [2, 8], [4, 8]];
var COPRIME_PAIRS = [[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [5, 6]];
var lcm = (a, b) => a / gcd(a, b) * b;
var reduce2 = (n, d) => {
  const g = gcd(Math.abs(n), Math.abs(d));
  return [n / g, d / g];
};
function ansExpr(n, d) {
  const [rn, rd] = reduce2(n, d);
  if (rn % rd === 0)
    return text(String(rn / rd));
  if (rn < rd)
    return frac(rn, rd);
  return mixed(Math.floor(rn / rd), rn % rd, rd);
}
function unreducedExpr(n, d) {
  if (n % d === 0)
    return text(String(n / d));
  if (n < d)
    return frac(n, d);
  return mixed(Math.floor(n / d), n % d, d);
}
function pushTrap(traps, value, trap, correctVal, allowEqual = false) {
  if (!allowEqual && Math.abs(exprValue(value) - correctVal) < 1e-9)
    return;
  traps.push({ value, trap });
}
function formTraps(traps, N, D) {
  if (gcd(N, D) > 1)
    traps.push({ value: unreducedExpr(N, D), trap: "\u6570\u503C\u76F8\u7B49\u4F46\u6CA1\u6709\u7EA6\u6210\u6700\u7B80\uFF0C\u8FD8\u8981\u7EE7\u7EED\u7EA6\u5206" });
}
function fillTraps(traps, N, D) {
  const correctVal = N / D;
  const keys = new Set(traps.map((t) => exprKey(t.value)));
  const cands = [
    [N + 1, D],
    [N, D + 1],
    [N, D * 2],
    [N * 2, D * 2 + 1],
    [N + 1, D * 2],
    [N + 2, D],
    [N * 2 + 1, D * 2],
    [N, D * 3],
    [N + 3, D]
  ];
  for (const [n, d] of cands) {
    if (keys.size >= 4)
      break;
    const v = frac(n, d);
    const k = exprKey(v);
    if (keys.has(k) || Math.abs(exprValue(v) - correctVal) < 1e-9)
      continue;
    keys.add(k);
    traps.push({ value: v, trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u4ED4\u7EC6\u7B97\u4E00\u904D" });
  }
}
function pickAddSubPair(rng) {
  let d1, d2;
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
var genFracAdd = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    const d = pick(rng, ARITH_DENOMS);
    const ns = [randomNumerator(rng, d), randomNumerator(rng, d), randomNumerator(rng, d)];
    const N2 = ns[0] + ns[1] + ns[2];
    const traps2 = [
      { value: frac(N2, d * 3), trap: "\u540C\u5206\u6BCD\u8FDE\u52A0\uFF0C\u5206\u6BCD\u4E0D\u53D8\uFF0C\u4E0D\u662F\u628A\u5206\u6BCD\u4E5F\u52A0\u8D77\u6765" },
      { value: frac(N2 - 1, d), trap: "\u6F0F\u52A0\u4E86\u4E00\u4E2A\u5206\u5B50\uFF0C\u518D\u6570\u4E00\u6570" },
      { value: frac(N2 + 1, d), trap: "\u5206\u5B50\u52A0\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D" }
    ];
    formTraps(traps2, N2, d);
    fillTraps(traps2, N2, d);
    return makeQuestion(
      { kind: "op", op: "+", terms: ns.map((n) => frac(n, d)) },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, d),
      traps2
    );
  }
  const { d1, d2, n1, n2 } = pickAddSubPair(rng);
  const D = lcm(d1, d2);
  const N = n1 * (D / d1) + n2 * (D / d2);
  const traps = [];
  if (d1 === d2) {
    pushTrap(traps, frac(N, d1 * 2), "\u540C\u5206\u6BCD\u76F8\u52A0\uFF0C\u5206\u6BCD\u4E0D\u53D8\uFF0C\u4E0D\u662F\u628A\u5206\u6BCD\u4E5F\u52A0\u8D77\u6765", N / D);
    pushTrap(traps, frac(N + 1, d1), "\u5206\u5B50\u52A0\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N / D);
  } else {
    pushTrap(traps, frac(n1 + n2, d1 + d2), "\u5F02\u5206\u6BCD\u76F8\u52A0\u8981\u5148\u901A\u5206\uFF0C\u4E0D\u80FD\u628A\u5206\u5B50\u5206\u6BCD\u5206\u522B\u76F8\u52A0", N / D);
    pushTrap(traps, frac(n1 + n2, D), "\u901A\u5206\u540E\u5206\u5B50\u4E5F\u8981\u4E58\u540C\u6837\u7684\u500D\u6570", N / D);
  }
  pushTrap(traps, ansExpr(n1 * n2, d1 * d2), "\u628A\u52A0\u6CD5\u7B97\u6210\u4E58\u6CD5\u4E86", N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: "op", op: "+", terms: [frac(n1, d1), frac(n2, d2)] },
    "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
    ansExpr(N, D),
    traps
  );
};
var genFracSub = (rng) => {
  rngGlobal = rng;
  const r = rng();
  if (r < 0.1) {
    const d = pick(rng, [4, 5, 6, 8]);
    const cs = coprimeNumerators(d);
    const lo = cs[0];
    const n12 = pick(rng, cs.filter((n) => n > 2 * lo));
    const n22 = pick(rng, cs.filter((n) => n < n12 - lo));
    const n3 = pick(rng, cs.filter((n) => n < n12 - n22));
    const N2 = n12 - n22 - n3;
    const traps2 = [];
    pushTrap(traps2, frac(n12 - n22 + n3, d), "\u7B26\u53F7\u770B\u9519\u4E86\uFF1A\u4E24\u4E2A\u51CF\u53F7\u90FD\u8981\u51CF", N2 / d);
    pushTrap(traps2, frac(n12 + n22 + n3, d), "\u628A\u51CF\u6CD5\u7B97\u6210\u52A0\u6CD5\u4E86", N2 / d);
    pushTrap(traps2, frac(N2 + 1, d), "\u5206\u5B50\u51CF\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / d);
    pushTrap(traps2, frac(n12, d), "\u540E\u4E24\u4E2A\u6570\u90FD\u6CA1\u51CF", N2 / d);
    formTraps(traps2, N2, d);
    fillTraps(traps2, N2, d);
    return makeQuestion(
      { kind: "op", op: "-", terms: [frac(n12, d), frac(n22, d), frac(n3, d)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7528\u6700\u7B80\u5206\u6570\u8868\u793A",
      ansExpr(N2, d),
      traps2
    );
  }
  if (r < 0.35) {
    const w = 2 + Math.floor(rng() * 4);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N2 = w * d - n;
    const traps2 = [];
    pushTrap(traps2, mixed(w - 1, n, d), "\u6574\u6570\u8981\u501F 1 \u53D8\u6210\u540C\u5206\u6BCD\u5206\u6570\u518D\u51CF", N2 / d);
    pushTrap(traps2, ansExpr(w * d + n, d), "\u628A\u51CF\u6CD5\u7B97\u6210\u52A0\u6CD5\u4E86", N2 / d);
    pushTrap(traps2, mixed(w, n, d), "\u6574\u6570\u90E8\u5206\u4E5F\u8981\u51CF\uFF0C\u4E0D\u662F\u7167\u6284", N2 / d);
    pushTrap(traps2, frac(N2 + 1, d), "\u5206\u5B50\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / d);
    formTraps(traps2, N2, d);
    fillTraps(traps2, N2, d);
    return makeQuestion(
      { kind: "op", op: "-", terms: [text(String(w)), frac(n, d)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, d),
      traps2
    );
  }
  let pair = pickAddSubPair(rng);
  for (let t = 0; t < 60 && pair.n1 / pair.d1 === pair.n2 / pair.d2; t++)
    pair = pickAddSubPair(rng);
  let { d1, d2, n1, n2 } = pair;
  if (n1 / d1 < n2 / d2) {
    [d1, d2] = [d2, d1];
    [n1, n2] = [n2, n1];
  }
  const D = lcm(d1, d2);
  const N = n1 * (D / d1) - n2 * (D / d2);
  const traps = [];
  if (d1 === d2) {
    pushTrap(traps, frac(N + 1, d1), "\u5206\u5B50\u51CF\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N / D);
    pushTrap(traps, frac(n1 + n2, d1), "\u628A\u51CF\u6CD5\u7B97\u6210\u52A0\u6CD5\u4E86", N / D);
    pushTrap(traps, frac(n2, d1), "\u53EA\u6284\u4E86\u51CF\u6570\uFF0C\u88AB\u51CF\u6570\u6CA1\u7528\u4E0A", N / D);
    pushTrap(traps, frac(n1, d1), "\u53EA\u6284\u4E86\u88AB\u51CF\u6570\uFF0C\u5FD8\u8BB0\u51CF", N / D);
    pushTrap(traps, frac(N, d1 * 2), "\u540C\u5206\u6BCD\u76F8\u51CF\uFF0C\u5206\u6BCD\u4E0D\u53D8\uFF0C\u4E0D\u8981\u7FFB\u500D", N / D);
  } else {
    if (Math.abs(n1 - n2) > 0)
      pushTrap(traps, frac(Math.abs(n1 - n2), Math.abs(d1 - d2)), "\u5F02\u5206\u6BCD\u76F8\u51CF\u8981\u5148\u901A\u5206\uFF0C\u4E0D\u80FD\u628A\u5206\u5B50\u5206\u6BCD\u5206\u522B\u76F8\u51CF", N / D);
    if (n1 > n2)
      pushTrap(traps, frac(n1 - n2, D), "\u901A\u5206\u540E\u5206\u5B50\u4E5F\u8981\u4E58\u540C\u6837\u7684\u500D\u6570", N / D);
    pushTrap(traps, frac(n1 * (D / d1), D), "\u7B2C\u4E8C\u4E2A\u6570\u5FD8\u901A\u5206\u4E86\uFF0C\u4E24\u4E2A\u5206\u5B50\u90FD\u8981\u4E58\u500D\u6570", N / D);
    pushTrap(traps, frac(n2 * (D / d2), D), "\u53EA\u7B97\u4E86\u7B2C\u4E8C\u4E2A\u6570\uFF0C\u4E0D\u662F\u51CF", N / D);
    pushTrap(traps, ansExpr(n1 * (D / d1) + n2 * (D / d2), D), "\u628A\u51CF\u6CD5\u7B97\u6210\u52A0\u6CD5\u4E86", N / D);
  }
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: "op", op: "-", terms: [frac(n1, d1), frac(n2, d2)] },
    "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7528\u6700\u7B80\u5206\u6570\u8868\u793A",
    ansExpr(N, D),
    traps
  );
};
function pickMulForm(rng) {
  const r = rng();
  return r < 1 / 3 ? 0 : r < 2 / 3 ? 1 : 2;
}
var genFracMul = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    const f = [0, 0, 0].map(() => {
      const d = pick(rng, ARITH_DENOMS);
      return { n: randomNumerator(rng, d), d };
    });
    const N2 = f[0].n * f[1].n * f[2].n;
    const D2 = f[0].d * f[1].d * f[2].d;
    const L = lcm(lcm(f[0].d, f[1].d), f[2].d);
    const sum = f.reduce((s, x) => s + x.n * (L / x.d), 0);
    const traps2 = [];
    pushTrap(traps2, frac(N2, f[0].d * f[1].d), "\u8FDE\u4E58\u8981\u628A\u6240\u6709\u5206\u6BCD\u90FD\u4E58\u8D77\u6765", N2 / D2);
    pushTrap(traps2, ansExpr(sum, L), "\u628A\u8FDE\u4E58\u7B97\u6210\u8FDE\u52A0\u4E86", N2 / D2);
    pushTrap(traps2, frac(N2, D2 + 1), "\u5206\u6BCD\u4E58\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / D2);
    pushTrap(traps2, frac(N2 + 1, D2), "\u5206\u5B50\u4E58\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / D2);
    formTraps(traps2, N2, D2);
    fillTraps(traps2, N2, D2);
    return makeQuestion(
      { kind: "op", op: "\xD7", terms: f.map((x) => frac(x.n, x.d)) },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, D2),
      traps2
    );
  }
  const form = pickMulForm(rng);
  if (form === 0) {
    const d12 = pick(rng, ARITH_DENOMS);
    const d22 = pick(rng, ARITH_DENOMS);
    const n12 = randomNumerator(rng, d12);
    const n22 = randomNumerator(rng, d22);
    const N2 = n12 * n22;
    const D2 = d12 * d22;
    const traps2 = [];
    pushTrap(traps2, ansExpr(n12 * d22, d12 * n22), "\u4E58\u6CD5\u4E0D\u9700\u8981\u5012\u6570\uFF0C\u90A3\u662F\u9664\u6CD5\u7684\u505A\u6CD5", N2 / D2);
    pushTrap(traps2, frac(N2, d12), "\u5206\u6BCD\u4E5F\u8981\u76F8\u4E58", N2 / D2);
    pushTrap(traps2, ansExpr(n12 * d22 + n22 * d12, d12 * d22), "\u628A\u4E58\u6CD5\u7B97\u6210\u52A0\u6CD5\u4E86", N2 / D2);
    formTraps(traps2, N2, D2);
    fillTraps(traps2, N2, D2);
    return makeQuestion(
      { kind: "op", op: "\xD7", terms: [frac(n12, d12), frac(n22, d22)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, D2),
      traps2
    );
  }
  if (form === 1) {
    const k = 2 + Math.floor(rng() * 8);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N2 = k * n;
    const traps2 = [];
    pushTrap(traps2, frac(n, d * k), "\u6574\u6570\u8981\u4E58\u5206\u5B50\uFF0C\u4E0D\u662F\u4E58\u5206\u6BCD", N2 / d);
    pushTrap(traps2, frac(k + n, d), "\u6574\u6570\u8981\u4E58\u5206\u5B50\uFF0C\u4E0D\u662F\u52A0\u5206\u5B50", N2 / d);
    pushTrap(traps2, frac(n, d), "\u5FD8\u8BB0\u4E58\u6574\u6570\u4E86", N2 / d);
    formTraps(traps2, N2, d);
    fillTraps(traps2, N2, d);
    return makeQuestion(
      { kind: "op", op: "\xD7", terms: [text(String(k)), frac(n, d)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, d),
      traps2
    );
  }
  const w = 1 + Math.floor(rng() * 5);
  const d1 = pick(rng, ARITH_DENOMS);
  const n1 = randomNumerator(rng, d1);
  const d2 = pick(rng, ARITH_DENOMS);
  const n2 = randomNumerator(rng, d2);
  const a = w * d1 + n1;
  const N = a * n2;
  const D = d1 * d2;
  const traps = [];
  {
    const [rn, rd] = reduce2(n1 * n2, d1 * d2);
    pushTrap(traps, mixed(w, rn, rd), "\u6574\u6570\u90E8\u5206\u4E5F\u8981\u4E58\uFF1A\u5148\u628A\u5E26\u5206\u6570\u5316\u6210\u5047\u5206\u6570\u518D\u4E58", N / D);
  }
  pushTrap(traps, frac(N, d1), "\u5206\u6BCD\u4E5F\u8981\u76F8\u4E58", N / D);
  pushTrap(traps, ansExpr(a * d2, d1 * n2), "\u4E58\u6CD5\u4E0D\u9700\u8981\u5012\u6570\uFF0C\u90A3\u662F\u9664\u6CD5\u7684\u505A\u6CD5", N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: "op", op: "\xD7", terms: [mixed(w, n1, d1), frac(n2, d2)] },
    "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
    ansExpr(N, D),
    traps
  );
};
var genFracDiv = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    const f = [0, 0, 0].map(() => {
      const d = pick(rng, ARITH_DENOMS);
      return { n: randomNumerator(rng, d), d };
    });
    const N2 = f[0].n * f[1].d * f[2].d;
    const D2 = f[0].d * f[1].n * f[2].n;
    const traps2 = [];
    pushTrap(traps2, ansExpr(f[0].n * f[1].d * f[2].n, f[0].d * f[1].n * f[2].d), "\u8FDE\u9664\u8981\u628A\u6BCF\u4E2A\u9664\u6570\u90FD\u5012\u8FC7\u6765\u4E58", N2 / D2);
    pushTrap(traps2, ansExpr(f[0].n * f[1].n * f[2].n, f[0].d * f[1].d * f[2].d), "\u9664\u4EE5\u4E00\u4E2A\u6570 = \u4E58\u5B83\u7684\u5012\u6570", N2 / D2);
    pushTrap(traps2, ansExpr(f[0].n * f[1].n * f[2].d, f[0].d * f[1].d * f[2].n), "\u5012\u9519\u5BF9\u8C61\u4E86\uFF0C\u770B\u6E05\u54EA\u4E2A\u662F\u9664\u6570", N2 / D2);
    pushTrap(traps2, frac(N2, D2 + 1), "\u5206\u6BCD\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / D2);
    formTraps(traps2, N2, D2);
    fillTraps(traps2, N2, D2);
    return makeQuestion(
      { kind: "op", op: "\xF7", terms: f.map((x) => frac(x.n, x.d)) },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, D2),
      traps2
    );
  }
  const r = rng();
  if (r < 0.5) {
    const d12 = pick(rng, ARITH_DENOMS);
    const d22 = pick(rng, ARITH_DENOMS);
    const n12 = randomNumerator(rng, d12);
    const n22 = randomNumerator(rng, d22);
    const N2 = n12 * d22;
    const D2 = d12 * n22;
    const traps2 = [];
    pushTrap(traps2, ansExpr(n12 * n22, d12 * d22), "\u9664\u4EE5\u5206\u6570 = \u4E58\u5B83\u7684\u5012\u6570\uFF0C\u5148\u628A\u9664\u6570\u5012\u8FC7\u6765", N2 / D2);
    pushTrap(traps2, ansExpr(d12 * n22, n12 * d22), "\u5012\u9519\u5BF9\u8C61\uFF1A\u8981\u5012\u7684\u662F\u9664\u6570\uFF08\xF7 \u540E\u9762\u7684\u6570\uFF09", N2 / D2);
    pushTrap(traps2, frac(n12 * d22 + 1, d12 * n22), "\u5206\u5B50\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / D2);
    pushTrap(traps2, frac(n12 * d22, d12 * n22 + 1), "\u5206\u6BCD\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", N2 / D2);
    formTraps(traps2, N2, D2);
    fillTraps(traps2, N2, D2);
    return makeQuestion(
      { kind: "op", op: "\xF7", terms: [frac(n12, d12), frac(n22, d22)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, D2),
      traps2
    );
  }
  if (r < 0.75) {
    const k = 2 + Math.floor(rng() * 8);
    const d = pick(rng, ARITH_DENOMS);
    const n = randomNumerator(rng, d);
    const N2 = k * d;
    const traps2 = [];
    pushTrap(traps2, ansExpr(k * n, d), "\u9664\u4EE5\u5206\u6570\u8981\u4E58\u5B83\u7684\u5012\u6570", N2 / n);
    pushTrap(traps2, frac(n, k * d), "\u5546\u5199\u5012\u4E86\uFF1A\u6574\u6570 \xF7 \u5206\u6570\uFF0C\u7ED3\u679C\u5E94\u8BE5\u66F4\u5927", N2 / n);
    pushTrap(traps2, frac(k, d * n), "\u8981\u4E58\u7684\u662F\u6574\u4E2A\u5012\u6570", N2 / n);
    pushTrap(traps2, frac(k, d), "\u53EA\u9664\u4E86\u5206\u6BCD\uFF0C\u5206\u5B50\u6CA1\u5904\u7406", N2 / n);
    pushTrap(traps2, text(String(k)), "\u5FD8\u8BB0\u9664\u4E86\uFF0C\u6574\u6570\u6CA1\u6709\u53D8\u5316", N2 / n);
    formTraps(traps2, N2, n);
    fillTraps(traps2, N2, n);
    return makeQuestion(
      { kind: "op", op: "\xF7", terms: [text(String(k)), frac(n, d)] },
      "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
      ansExpr(N2, n),
      traps2
    );
  }
  const w = 1 + Math.floor(rng() * 5);
  const d1 = pick(rng, ARITH_DENOMS);
  const n1 = randomNumerator(rng, d1);
  const d2 = pick(rng, ARITH_DENOMS);
  const n2 = randomNumerator(rng, d2);
  const a = w * d1 + n1;
  const N = a * d2;
  const D = d1 * n2;
  const traps = [];
  pushTrap(traps, ansExpr(a * n2, d1 * d2), "\u9664\u4EE5\u5206\u6570 = \u4E58\u5B83\u7684\u5012\u6570\uFF0C\u5148\u628A\u9664\u6570\u5012\u8FC7\u6765", N / D);
  pushTrap(traps, ansExpr(n1 * d2, d1 * n2), "\u6F0F\u6389\u6574\u6570\u90E8\u5206\uFF1A\u5148\u628A\u5E26\u5206\u6570\u5316\u6210\u5047\u5206\u6570\u518D\u9664", N / D);
  pushTrap(traps, ansExpr(w * d2, n2), "\u5E26\u5206\u6570\u8981\u6574\u4F53\u5316\u5047\u5206\u6570\uFF0C\u4E0D\u80FD\u53EA\u7B97\u6574\u6570\u90E8\u5206", N / D);
  formTraps(traps, N, D);
  fillTraps(traps, N, D);
  return makeQuestion(
    { kind: "op", op: "\xF7", terms: [mixed(w, n1, d1), frac(n2, d2)] },
    "\u8BA1\u7B97\uFF0C\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF08\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
    ansExpr(N, D),
    traps
  );
};
var fracAddSkill = {
  id: "g6-frac-add",
  title: "\u5206\u6570\u52A0\u6CD5",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5206\u6570\u52A0\u6CD5\u901F\u7B97\uFF08\u4E24\u9879 90% + \u4E09\u9879\u8FDE\u52A0 10%\uFF09",
    "\u540C\u5206\u6BCD 50%\uFF1A\u5206\u6BCD\u4E0D\u53D8\u5206\u5B50\u76F8\u52A0\uFF1B\u5F02\u5206\u6BCD 50%\uFF1A\u5148\u901A\u5206\u518D\u52A0\uFF0870% \u5206\u6BCD\u6210\u500D\u6570\u5173\u7CFB\uFF09",
    "\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\u5373\u53EF\uFF0C\u5047\u5206\u6570\u3001\u5E26\u5206\u6570\u90FD\u7B97\u5BF9\uFF08\u4F8B\u5982 1/2 + 3/4 = 5/4 \u6216 1\xBC\uFF09",
    "\u5C0F\u5FC3\u9677\u9631\uFF1A\u5206\u6BCD\u4E5F\u52A0\u3001\u901A\u5206\u5FD8\u4E58\u5206\u5B50\u3001\u628A\u52A0\u6CD5\u7B97\u6210\u4E58\u6CD5"
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracAdd]
};
var fracSubSkill = {
  id: "g6-frac-sub",
  title: "\u5206\u6570\u51CF\u6CD5",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5206\u6570\u51CF\u6CD5\u901F\u7B97\uFF08\u4E24\u9879 90% + \u4E09\u9879\u8FDE\u51CF 10%\uFF0C\u7ED3\u679C\u4FDD\u8BC1\u4E3A\u6B63\uFF09",
    "\u540C\u5206\u6BCD 50%\u3001\u5F02\u5206\u6BCD 50%\uFF0C\u53E6\u6709 25% \u662F\u6574\u6570\u51CF\u5206\u6570\uFF08\u7EC3\u501F\u4F4D\uFF09",
    "\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\u5373\u53EF\uFF0C\u5047\u5206\u6570\u3001\u5E26\u5206\u6570\u90FD\u7B97\u5BF9\uFF08\u4F8B\u5982 2 - 3/4 = 5/4 \u6216 1\xBC\uFF09",
    "\u5C0F\u5FC3\u9677\u9631\uFF1A\u5206\u5B50\u5206\u6BCD\u5206\u522B\u76F8\u51CF\u3001\u628A\u51CF\u6CD5\u7B97\u6210\u52A0\u6CD5\u3001\u6574\u6570\u5FD8\u501F\u4F4D"
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracSub]
};
var fracMulSkill = {
  id: "g6-frac-mul",
  title: "\u5206\u6570\u4E58\u6CD5",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5206\u6570\u4E58\u6CD5\u901F\u7B97\uFF08\u4E24\u9879 90% + \u4E09\u9879\u8FDE\u4E58 10%\uFF09",
    "\u4E09\u79CD\u5F62\u6001\u5747\u5300\uFF1A\u771F\u5206\u6570\xD7\u771F\u5206\u6570 / \u6574\u6570\xD7\u5206\u6570 / \u5E26\u5206\u6570\xD7\u5206\u6570",
    "\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\u5373\u53EF\uFF0C\u5047\u5206\u6570\u3001\u5E26\u5206\u6570\u90FD\u7B97\u5BF9\uFF1B\u80FD\u7EA6\u5206\u5148\u7EA6\u5206\u66F4\u5FEB\uFF08\u4F8B\u5982 3/4 \xD7 2/3 = 1/2\uFF09",
    "\u5C0F\u5FC3\u9677\u9631\uFF1A\u8BEF\u7528\u5012\u6570\uFF08\u90A3\u662F\u9664\u6CD5\uFF01\uFF09\u3001\u53EA\u4E58\u5206\u5B50\u3001\u5E26\u5206\u6570\u6574\u6570\u5FD8\u4E58"
  ],
  timeLimitSec: 15,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracMul]
};
var fracDivSkill = {
  id: "g6-frac-div",
  title: "\u5206\u6570\u9664\u6CD5",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5206\u6570\u9664\u6CD5\u901F\u7B97\uFF08\u4E24\u9879 90% + \u4E09\u9879\u8FDE\u9664 10%\uFF09",
    "\u53E3\u8BC0\uFF1A\u9664\u4EE5\u4E00\u4E2A\u6570 = \u4E58\u5B83\u7684\u5012\u6570\uFF08\u5012\u7684\u662F \xF7 \u540E\u9762\u7684\u6570\uFF01\uFF09",
    "\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\u5373\u53EF\uFF0C\u5047\u5206\u6570\u3001\u5E26\u5206\u6570\u90FD\u7B97\u5BF9\uFF08\u4F8B\u5982 1\xBD \xF7 3/4 = 2\uFF09",
    "\u5C0F\u5FC3\u9677\u9631\uFF1A\u5FD8\u5012\u76F4\u63A5\u4E58\u3001\u5012\u9519\u5BF9\u8C61\u3001\u6F0F\u6389\u5E26\u5206\u6570\u7684\u6574\u6570\u90E8\u5206"
  ],
  timeLimitSec: 18,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracDiv]
};
var fmtTenth = (t) => {
  const sign = t < 0 ? "-" : "";
  const a = Math.abs(t);
  const i = Math.floor(a / 10);
  const f = a % 10;
  return sign + (f === 0 ? String(i) : `${i}.${f}`);
};
function signedTenth(rng, decimal) {
  if (decimal) {
    let t2 = Math.floor(rng() * 197) - 98;
    if (t2 % 10 === 0)
      t2 += 1 + Math.floor(rng() * 8);
    return t2;
  }
  let t = (Math.floor(rng() * 39) - 19) * 10;
  return t === 0 ? 10 : t;
}
function fillTextTraps(traps, rTenth) {
  const keys = new Set(traps.map((t) => exprKey(t.value)));
  for (const dt of [10, -10, 20, -20, 30, -30, 40, -40]) {
    if (keys.size >= 4)
      break;
    const v = text(fmtTenth(rTenth + dt));
    const k = exprKey(v);
    if (keys.has(k))
      continue;
    keys.add(k);
    traps.push({ value: v, trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u4ED4\u7EC6\u7B97\u4E00\u904D" });
  }
}
function pushTextTrap(traps, tTenth, trap, correctTenth) {
  if (tTenth === correctTenth)
    return;
  traps.push({ value: text(fmtTenth(tTenth)), trap });
}
var genSignedAddSub = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.1) {
    const a2 = signedTenth(rng, false);
    const b2 = signedTenth(rng, false);
    const c = signedTenth(rng, false);
    const r2 = a2 + b2 + c;
    const traps2 = [];
    pushTextTrap(traps2, -r2, "\u7B26\u53F7\u770B\u53CD\u4E86", r2);
    pushTextTrap(traps2, (Math.abs(a2) + Math.abs(b2) + Math.abs(c)) * (r2 >= 0 ? 1 : -1), "\u4E0D\u80FD\u5168\u5F53\u540C\u53F7\u76F8\u52A0\uFF0C\u8D1F\u9879\u8981\u62B5\u6D88", r2);
    pushTextTrap(traps2, a2 + b2 - c, "\u6700\u540E\u4E00\u9879\u7684\u7B26\u53F7\u770B\u9519\u4E86", r2);
    fillTextTraps(traps2, r2);
    return makeQuestion(
      { kind: "op", op: "+", terms: [text(fmtTenth(a2)), text(fmtTenth(b2)), text(fmtTenth(c))] },
      "\u8BA1\u7B97\uFF08\u6CE8\u610F\u6B63\u8D1F\u53F7\uFF09",
      text(fmtTenth(r2)),
      traps2
    );
  }
  const decimal = rng() < 0.3;
  const a = signedTenth(rng, decimal);
  const b = signedTenth(rng, decimal);
  const isSub = rng() < 0.5;
  const r = isSub ? a - b : a + b;
  const traps = [];
  if (isSub) {
    pushTextTrap(traps, b - a, "\u65B9\u5411\u53CD\u4E86\uFF1A\u88AB\u51CF\u6570 \u2212 \u51CF\u6570\uFF0C\u4E0D\u662F\u5012\u8FC7\u6765\u51CF", r);
    pushTextTrap(traps, a + b, "\u51CF\u53BB\u4E00\u4E2A\u6570 = \u52A0\u4E0A\u5B83\u7684\u76F8\u53CD\u6570\uFF0C\u7B26\u53F7\u8981\u53D8", r);
    pushTextTrap(traps, -r, "\u7B26\u53F7\u770B\u53CD\u4E86", r);
  } else if (a > 0 !== b > 0) {
    const bigSign = Math.abs(a) > Math.abs(b) ? Math.sign(a) : Math.sign(b);
    pushTextTrap(traps, bigSign * (Math.abs(a) + Math.abs(b)), "\u5F02\u53F7\u76F8\u52A0\u662F\u7EDD\u5BF9\u503C\u62B5\u6D88\uFF0C\u4E0D\u662F\u76F8\u52A0", r);
    pushTextTrap(traps, -r, "\u7B26\u53F7\u770B\u53CD\u4E86\uFF1A\u8DDF\u7EDD\u5BF9\u503C\u5927\u7684\u6570\u8D70", r);
    pushTextTrap(traps, (Math.abs(a) + Math.abs(b)) * -bigSign, "\u5F02\u53F7\u76F8\u52A0\u65E2\u7B97\u9519\u53C8\u4E22\u7B26\u53F7", r);
  } else {
    pushTextTrap(traps, Math.abs(a) - Math.abs(b), "\u540C\u53F7\u76F8\u52A0\uFF0C\u7EDD\u5BF9\u503C\u8981\u76F8\u52A0\uFF0C\u4E0D\u662F\u62B5\u6D88", r);
    pushTextTrap(traps, -r, "\u540C\u53F7\u76F8\u52A0\u7B26\u53F7\u4E0D\u53D8", r);
  }
  fillTextTraps(traps, r);
  return makeQuestion(
    { kind: "op", op: isSub ? "-" : "+", terms: [text(fmtTenth(a)), text(fmtTenth(b))] },
    "\u8BA1\u7B97\uFF08\u6CE8\u610F\u6B63\u8D1F\u53F7\uFF09",
    text(fmtTenth(r)),
    traps
  );
};
var genSignFlash = (rng) => {
  rngGlobal = rng;
  const pos = text("\u6B63\u6570");
  const neg = text("\u8D1F\u6570");
  const zero = text("\u7B49\u4E8E 0");
  const hint = "\u5F02\u53F7\u76F8\u52A0\uFF0C\u7B26\u53F7\u8DDF\u7EDD\u5BF9\u503C\u5927\u7684\u6570\u8D70\uFF1B\u540C\u53F7\u76F8\u52A0\u7B26\u53F7\u4E0D\u53D8";
  if (rng() < 0.12) {
    const a2 = (1 + Math.floor(rng() * 15)) * 10;
    const first = rng() < 0.5;
    const terms = first ? [text(fmtTenth(-a2)), text(fmtTenth(a2))] : [text(fmtTenth(a2)), text(fmtTenth(-a2))];
    return makeQuestion(
      { kind: "op", op: "+", terms },
      "\u4E0D\u8BA1\u7B97\uFF0C\u5224\u65AD\u7ED3\u679C\u662F\u6B63\u8FD8\u662F\u8D1F",
      zero,
      [
        { value: pos, trap: "\u8FD9\u4E24\u4E2A\u6570\u4E92\u4E3A\u76F8\u53CD\u6570\uFF0C\u76F8\u52A0\u7B49\u4E8E 0" },
        { value: neg, trap: "\u8FD9\u4E24\u4E2A\u6570\u4E92\u4E3A\u76F8\u53CD\u6570\uFF0C\u76F8\u52A0\u7B49\u4E8E 0" }
      ]
    );
  }
  const three = rng() < 0.2;
  const isSub = !three && rng() < 0.4;
  const a = signedTenth(rng, false);
  const b = signedTenth(rng, false);
  if (three) {
    const c = signedTenth(rng, false);
    const v2 = a + b + c;
    const correct2 = v2 > 0 ? pos : v2 < 0 ? neg : zero;
    const traps2 = [pos, neg, zero].filter((x) => exprKey(x) !== exprKey(correct2)).map((x) => ({
      value: x,
      trap: exprKey(x) === "\u7B49\u4E8E 0" ? "\u4E09\u9879\u4E0D\u4F1A\u6070\u597D\u62B5\u6D88\uFF0C\u518D\u4F30\u4E00\u4F30\u7EDD\u5BF9\u503C" : hint
    }));
    return makeQuestion(
      { kind: "op", op: "+", terms: [text(fmtTenth(a)), text(fmtTenth(b)), text(fmtTenth(c))] },
      "\u4E0D\u8BA1\u7B97\uFF0C\u5224\u65AD\u7ED3\u679C\u662F\u6B63\u8FD8\u662F\u8D1F",
      correct2,
      traps2
    );
  }
  const v = isSub ? a - b : a + b;
  const correct = v > 0 ? pos : v < 0 ? neg : zero;
  const traps = [pos, neg, zero].filter((x) => exprKey(x) !== exprKey(correct)).map((x) => ({
    value: x,
    trap: exprKey(x) === "\u7B49\u4E8E 0" ? "\u4E24\u8FB9\u7EDD\u5BF9\u503C\u4E0D\u4E00\u6837\u5927\uFF0C\u4E0D\u4F1A\u7B49\u4E8E 0" : isSub ? "\u51CF\u53BB\u8D1F\u6570 = \u52A0\u6B63\u6570\uFF0C\u65B9\u5411\u60F3\u6E05\u695A" : hint
  }));
  return makeQuestion(
    { kind: "op", op: isSub ? "-" : "+", terms: [text(fmtTenth(a)), text(fmtTenth(b))] },
    "\u4E0D\u8BA1\u7B97\uFF0C\u5224\u65AD\u7ED3\u679C\u662F\u6B63\u8FD8\u662F\u8D1F",
    correct,
    traps
  );
};
var signFlashSkill = {
  id: "g6-sign-flash",
  title: "\u7B26\u53F7\u5FEB\u95EA",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u4E0D\u8BA1\u7B97\uFF0C\u53EA\u5224\u65AD\u6B63\u8D1F\u6570\u52A0\u51CF\u7ED3\u679C\u7684\u6B63\u8D1F\uFF08\u6570\u611F\u539F\u5B50\u80FD\u529B C3\uFF09",
    "\u53E3\u8BC0\uFF1A\u540C\u53F7\u76F8\u52A0\u7B26\u53F7\u4E0D\u53D8\uFF1B\u5F02\u53F7\u76F8\u52A0\uFF0C\u7B26\u53F7\u8DDF\u7EDD\u5BF9\u503C\u5927\u7684\u8D70\uFF1B\u51CF\u8D1F\u6570 = \u52A0\u6B63\u6570",
    "\u7EA6\u4E00\u6210\u9898\u76EE\u7ED3\u679C\u6070\u597D\u7B49\u4E8E 0\uFF08\u4E92\u4E3A\u76F8\u53CD\u6570\uFF09",
    "\u9650\u65F6\u5F88\u77ED\uFF0C\u51ED\u76F4\u89C9\u79D2\u6740\uFF01\u672C\u9898\u578B\u53EA\u6709\u95EF\u5173\u548C\u8FDB\u9636\u4E24\u79CD\u6A21\u5F0F"
  ],
  timeLimitSec: 5,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignFlash]
};
var signedAddSkill = {
  id: "g6-signed-add",
  title: "\u6B63\u8D1F\u6570\u52A0\u51CF",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u6B63\u8D1F\u6570\u52A0\u51CF\u901F\u7B97\uFF08\u4E24\u9879 90% + \u4E09\u9879\u4EE3\u6570\u548C 10%\uFF09",
    '\u6574\u6570 70% + \u4E00\u4F4D\u5C0F\u6570 30%\uFF0C\u8303\u56F4 \xB120\uFF1B\u51CF\u6CD5\u542B"\u51CF\u53BB\u8D1F\u6570"',
    "\u5148\u5B9A\u7B26\u53F7\u518D\u7B97\u7EDD\u5BF9\u503C\uFF1A\u540C\u53F7\u76F8\u52A0\u3001\u5F02\u53F7\u62B5\u6D88\uFF1B\u51CF\u8D1F\u6570 = \u52A0\u6B63\u6570",
    "\u590D\u4E60\u6A21\u5F0F\u952E\u76D8\u6709\u8D1F\u53F7\u952E\uFF0C\u8D1F\u6570\u7B54\u6848\u5148\u6309 \u2212 \u518D\u8F93\u6570\u5B57"
  ],
  timeLimitSec: 15,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genSignedAddSub]
};
var genCommonDenom = (rng) => {
  rngGlobal = rng;
  let d1, d2;
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
  const prompt = { kind: "op", op: "\u548C", terms: [frac(n1, d1), frac(n2, d2)] };
  if (rng() < 0.6) {
    let askFirst = rng() < 0.5;
    if (askFirst && d1 === L)
      askFirst = false;
    if (!askFirst && d2 === L)
      askFirst = true;
    const qN = askFirst ? n1 : n2;
    const qD = askFirst ? d1 : d2;
    const oN = askFirst ? n2 : n1;
    const oD = askFirst ? d2 : d1;
    const cN = qN * (L / qD);
    const v = cN / L;
    const traps2 = [];
    pushTrap(traps2, frac(oN * (L / oD), L), "\u90A3\u662F\u53E6\u4E00\u4E2A\u5206\u6570\u901A\u5206\u540E\u7684\u6837\u5B50\uFF0C\u770B\u6E05\u95EE\u7684\u662F\u54EA\u8FB9", v);
    pushTrap(traps2, frac(qN, L), "\u901A\u5206\u540E\u5206\u5B50\u4E5F\u8981\u4E58\u540C\u6837\u7684\u500D\u6570", v);
    pushTrap(traps2, frac(cN, qD), "\u5206\u6BCD\u8981\u53D8\u6210\u4E24\u4E2A\u5206\u6BCD\u7684\u516C\u500D\u6570", v);
    fillTraps(traps2, cN, L);
    return makeQuestion(prompt, `\u628A ${qN}/${qD} \u901A\u5206\u540E\u53D8\u6210\u54EA\u4E2A\uFF1F`, frac(cN, L), traps2);
  }
  const traps = [];
  pushTrap(traps, text(String(d1 * d2)), "\u53EF\u4EE5\u66F4\u5C0F\uFF1A\u7528\u4E24\u4E2A\u5206\u6BCD\u7684\u6700\u5C0F\u516C\u500D\u6570", L);
  pushTrap(traps, text(String(d1 + d2)), "\u516C\u5206\u6BCD\u4E0D\u662F\u628A\u5206\u6BCD\u76F8\u52A0", L);
  pushTrap(traps, text(String(L * 2)), "\u662F\u516C\u500D\u6570\u4F46\u4E0D\u662F\u6700\u5C0F\u7684", L);
  {
    const keys = new Set(traps.map((t) => exprKey(t.value)));
    for (const dt of [1, -1, 2, 4, -2]) {
      if (keys.size >= 4)
        break;
      if (L + dt <= 0)
        continue;
      const v2 = text(String(L + dt));
      if (keys.has(exprKey(v2)))
        continue;
      keys.add(exprKey(v2));
      traps.push({ value: v2, trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" });
    }
  }
  return makeQuestion(prompt, "\u901A\u5206\u7528\u7684\u6700\u5C0F\u516C\u5206\u6BCD\u662F\uFF1F", text(String(L)), traps);
};
var genCrossCancel = (rng) => {
  rngGlobal = rng;
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
    if (n1 < d1 && n2 < d2)
      break;
  }
  const [c1n, c1d] = reduce2(x, w);
  const [c2n, c2d] = reduce2(z, y);
  const promptExpr = { kind: "op", op: "\xD7", terms: [frac(n1, d1), frac(n2, d2)] };
  const pv = exprValue(promptExpr);
  const correct = { kind: "op", op: "\xD7", terms: [frac(c1n, c1d), frac(c2n, c2d)] };
  const traps = [];
  pushTrap(traps, { kind: "op", op: "\xD7", terms: [frac(c1n, c1d), frac(n2, d2)] }, "\u8FD8\u6CA1\u7EA6\u5B8C\uFF1A\u53F3\u8FB9\u7684\u5206\u5B50\u548C\u5DE6\u8FB9\u7684\u5206\u6BCD\u4E5F\u80FD\u7EA6", pv, true);
  pushTrap(traps, { kind: "op", op: "\xD7", terms: [frac(n1, d1), frac(c2n, c2d)] }, "\u8FD8\u6CA1\u7EA6\u5B8C\uFF1A\u53E6\u4E00\u5BF9\u4E5F\u80FD\u7EA6", pv, true);
  pushTrap(traps, { kind: "op", op: "\xD7", terms: [frac(c1n, c1d + 1), frac(c2n, c2d)] }, "\u7EA6\u5206\u540E\u5206\u6BCD\u7B97\u9519\u4E86", pv);
  pushTrap(traps, { kind: "op", op: "\xD7", terms: [frac(c1n + 1, c1d), frac(c2n, c2d)] }, "\u7EA6\u5206\u540E\u5206\u5B50\u7B97\u9519\u4E86", pv);
  return makeQuestion(promptExpr, "\u5148\u7EA6\u5206\u518D\u4E58\uFF0C\u7EA6\u5206\u540E\u7684\u5F0F\u5B50\u662F\u54EA\u4E2A\uFF1F", correct, traps);
};
var RECIP_DECIMALS = [
  ["0.5", text("2")],
  ["0.25", text("4")],
  ["0.2", text("5")],
  ["0.125", text("8")],
  ["0.4", frac(5, 2)],
  ["0.75", frac(4, 3)],
  ["1.5", frac(2, 3)],
  ["1.25", frac(4, 5)]
];
var genReciprocal = (rng) => {
  rngGlobal = rng;
  const form = rng();
  const neg = rng() < 0.3;
  const s = neg ? "-" : "";
  if (form < 0.35) {
    const d2 = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9]);
    const n2 = randomNumerator(rng, d2);
    const traps2 = [
      { value: frac(s + n2, d2), trap: "\u5FD8\u5012\u4E86\uFF1A\u5206\u5B50\u5206\u6BCD\u8981\u4EA4\u6362\u4F4D\u7F6E" },
      { value: frac(s + (d2 + 1), n2), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" },
      { value: frac(s + d2, n2 + 1), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" }
    ];
    return makeQuestion(frac(s + n2, d2), "\u5199\u51FA\u5B83\u7684\u5012\u6570", frac(s + d2, n2), traps2);
  }
  if (form < 0.6) {
    const k = 2 + Math.floor(rng() * 11);
    const traps2 = [
      { value: text(s + k), trap: `\u6574\u6570\u7684\u5012\u6570\u662F 1/${k}\uFF0C\u4E0D\u662F\u5B83\u672C\u8EAB` },
      { value: text(s + "1"), trap: "\u5012\u6570\u8981\u5012\u8FC7\u6765\uFF0C\u4E0D\u662F\u4E0D\u53D8" },
      { value: frac(s + "2", k), trap: "\u5206\u5B50\u662F 1" }
    ];
    return makeQuestion(text(s + k), "\u5199\u51FA\u5B83\u7684\u5012\u6570", frac(s + "1", k), traps2);
  }
  if (form < 0.8) {
    const [dec, ans] = pick(rng, RECIP_DECIMALS);
    const av = exprValue(ans);
    const traps2 = [{ value: text(dec), trap: "\u5FD8\u5012\u4E86\uFF0C\u8FD9\u662F\u539F\u6570" }];
    if (ans.kind === "text") {
      traps2.push({ value: text(String(Number(ans.text) + 1)), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" });
      traps2.push({ value: text(String(Math.max(1, Number(ans.text) - 1))), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" });
    } else if (ans.kind === "frac") {
      traps2.push({ value: frac(ans.d, ans.n), trap: "\u5012\u7684\u65B9\u5411\u53CD\u4E86" });
      traps2.push({ value: frac(Number(ans.n) + 1, ans.d), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" });
    }
    if (neg) {
      const negAns = ans.kind === "text" ? text("-" + ans.text) : frac("-" + ans.n, ans.d);
      const negTraps = traps2.map((t) => ({
        trap: t.trap,
        value: t.value.kind === "text" ? text("-" + t.value.text) : t.value
      }));
      return makeQuestion(text("-" + dec), "\u5199\u51FA\u5B83\u7684\u5012\u6570", negAns, negTraps);
    }
    return makeQuestion(text(dec), "\u5199\u51FA\u5B83\u7684\u5012\u6570", ans, traps2);
  }
  const w = 1 + Math.floor(rng() * 3);
  const d = pick(rng, [2, 3, 4, 5, 6, 8]);
  const n = randomNumerator(rng, d);
  const a = w * d + n;
  const traps = [
    { value: frac(s + d, n), trap: "\u5E26\u5206\u6570\u8981\u5148\u5316\u6210\u5047\u5206\u6570\u518D\u5012\uFF0C\u4E0D\u80FD\u53EA\u5012\u5206\u6570\u90E8\u5206" },
    { value: frac(s + a, d), trap: "\u8FD9\u662F\u539F\u6570\uFF08\u5047\u5206\u6570\u5F62\u5F0F\uFF09\uFF0C\u8FD8\u6CA1\u5012" },
    { value: frac(s + (d + 1), a), trap: "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u7B97\u4E00\u904D" }
  ];
  return makeQuestion(mixed(Number(s + w), n, d), "\u5199\u51FA\u5B83\u7684\u5012\u6570", frac(s + d, a), traps);
};
function intTenth(rng, maxAbs) {
  const k = 1 + Math.floor(rng() * maxAbs);
  return (rng() < 0.5 ? -1 : 1) * k * 10;
}
var genOppositeAbs = (rng) => {
  rngGlobal = rng;
  const v = signedTenth(rng, rng() < 0.25);
  const V = Math.abs(v);
  const variant = rng();
  let promptText, requirement, r, hint;
  if (variant < 0.3) {
    promptText = fmtTenth(v);
    requirement = "\u5199\u51FA\u5B83\u7684\u76F8\u53CD\u6570";
    r = -v;
    hint = "\u76F8\u53CD\u6570\u5C31\u662F\u7B26\u53F7\u53CD\u8FC7\u6765";
  } else if (variant < 0.55) {
    promptText = `-(${fmtTenth(v)})`;
    requirement = "\u5316\u7B80";
    r = -v;
    hint = "\u62EC\u53F7\u524D\u662F\u8D1F\u53F7\uFF0C\u53BB\u6389\u62EC\u53F7\u8981\u53D8\u53F7";
  } else if (variant < 0.8) {
    promptText = `|${fmtTenth(v)}|`;
    requirement = "\u5316\u7B80";
    r = V;
    hint = "\u7EDD\u5BF9\u503C\u662F\u975E\u8D1F\u7684";
  } else {
    promptText = `-|${fmtTenth(v)}|`;
    requirement = "\u5316\u7B80";
    r = -V;
    hint = "\u8D1F\u53F7\u5728\u7EDD\u5BF9\u503C\u5916\u9762\uFF0C\u7ED3\u679C\u662F\u8D1F\u7684";
  }
  const traps = [];
  pushTextTrap(traps, -r, hint, r);
  pushTextTrap(traps, v, "\u8FD9\u662F\u539F\u6570\uFF0C\u518D\u60F3\u60F3\u89C4\u5219", r);
  fillTextTraps(traps, r);
  return makeQuestion(text(promptText), requirement, text(fmtTenth(r)), traps);
};
var genSignCompare = (rng) => {
  rngGlobal = rng;
  const sameT = text("\u4E00\u6837\u5927");
  if (rng() < 0.1) {
    const iv = Math.floor(rng() * 15) - 7 || 1;
    const left2 = text(String(iv));
    const right2 = text(`${iv}.0`);
    const traps2 = [
      { value: left2, trap: "\u4E24\u8FB9\u5176\u5B9E\u76F8\u7B49\uFF1A3 \u548C 3.0 \u4E00\u6837\u5927" },
      { value: right2, trap: "\u4E24\u8FB9\u5176\u5B9E\u76F8\u7B49\uFF1A3 \u548C 3.0 \u4E00\u6837\u5927" }
    ];
    return makeQuestion({ kind: "vs", left: left2, right: right2 }, "\u54EA\u8FB9\u66F4\u5927\uFF1F", sameT, traps2);
  }
  const decimal = rng() < 0.3;
  let v1 = signedTenth(rng, decimal);
  let v2 = signedTenth(rng, decimal);
  for (let t = 0; t < 60 && (v1 === v2 || Math.abs(v1 - v2) > 60); t++)
    v2 = signedTenth(rng, decimal);
  const left = text(fmtTenth(v1));
  const right = text(fmtTenth(v2));
  const bigger = v1 > v2 ? left : right;
  const smaller = v1 > v2 ? right : left;
  const hasNeg = v1 < 0 || v2 < 0;
  const traps = [
    { value: smaller, trap: hasNeg ? "\u8D1F\u6570\u6BD4\u8F83\uFF1A\u7EDD\u5BF9\u503C\u5927\u7684\u53CD\u800C\u5C0F" : "\u8FD9\u4E2A\u66F4\u5C0F\uFF0C\u518D\u4ED4\u7EC6\u6BD4" },
    { value: sameT, trap: "\u4E24\u8FB9\u4E0D\u76F8\u7B49\uFF0C\u518D\u4ED4\u7EC6\u6BD4" }
  ];
  return makeQuestion({ kind: "vs", left, right }, "\u54EA\u8FB9\u66F4\u5927\uFF1F", bigger, traps);
};
var genSignFlashMul = (rng) => {
  rngGlobal = rng;
  const cnt = 2 + Math.floor(rng() * 3);
  const terms = Array.from({ length: cnt }, () => intTenth(rng, 9));
  const op = rng() < 0.7 ? "\xD7" : "\xF7";
  const negCount = terms.filter((t) => t < 0).length;
  const isPos = negCount % 2 === 0;
  const pos = text("\u6B63\u6570");
  const neg = text("\u8D1F\u6570");
  const zero = text("\u7B49\u4E8E 0");
  const hint = "\u6570\u8D1F\u6570\u7684\u4E2A\u6570\uFF1A\u5076\u6570\u4E2A\u5F97\u6B63\uFF0C\u5947\u6570\u4E2A\u5F97\u8D1F";
  const correct = isPos ? pos : neg;
  const traps = [pos, neg, zero].filter((x) => exprKey(x) !== exprKey(correct)).map((x) => ({
    value: x,
    trap: exprKey(x) === "\u7B49\u4E8E 0" ? "\u6CA1\u6709 0 \u56E0\u6570\uFF0C\u7ED3\u679C\u4E0D\u4F1A\u662F 0" : hint
  }));
  return makeQuestion(
    { kind: "op", op, terms: terms.map((t) => text(fmtTenth(t))) },
    "\u4E0D\u8BA1\u7B97\uFF0C\u5224\u65AD\u7ED3\u679C\u662F\u6B63\u8FD8\u662F\u8D1F",
    correct,
    traps
  );
};
var genSignedMulDiv = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.55) {
    const decimal = rng() < 0.25;
    const a = decimal ? signedTenth(rng, true) : intTenth(rng, 9);
    const b2 = intTenth(rng, 9);
    const r = a * b2 / 10;
    const traps2 = [];
    pushTextTrap(traps2, -r, "\u7B26\u53F7\u89C4\u5219\uFF1A\u540C\u53F7\u5F97\u6B63\uFF0C\u5F02\u53F7\u5F97\u8D1F", r);
    pushTextTrap(traps2, r + b2, "\u79EF\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", r);
    pushTextTrap(traps2, r - b2, "\u79EF\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", r);
    fillTextTraps(traps2, r);
    return makeQuestion(
      { kind: "op", op: "\xD7", terms: [text(fmtTenth(a)), text(fmtTenth(b2))] },
      "\u8BA1\u7B97\uFF08\u6CE8\u610F\u6B63\u8D1F\u53F7\uFF09",
      text(fmtTenth(r)),
      traps2
    );
  }
  const b = intTenth(rng, 9);
  const q = intTenth(rng, 9);
  const dividend = b * q / 10;
  const traps = [];
  pushTextTrap(traps, -q, "\u7B26\u53F7\u89C4\u5219\uFF1A\u540C\u53F7\u5F97\u6B63\uFF0C\u5F02\u53F7\u5F97\u8D1F", q);
  pushTextTrap(traps, q + b, "\u5546\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", q);
  pushTextTrap(traps, q - b, "\u5546\u7B97\u9519\u4E86\uFF0C\u518D\u7B97\u4E00\u904D", q);
  fillTextTraps(traps, q);
  return makeQuestion(
    { kind: "op", op: "\xF7", terms: [text(fmtTenth(dividend)), text(fmtTenth(b))] },
    "\u8BA1\u7B97\uFF08\u6CE8\u610F\u6B63\u8D1F\u53F7\uFF09",
    text(fmtTenth(q)),
    traps
  );
};
var lcdSkill = {
  id: "g6-sense-lcd",
  title: "\u901A\u5206\u5FEB\u95EA",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u901A\u5206\uFF08\u5F02\u5206\u6BCD\u52A0\u51CF\u7684\u5730\u57FA\uFF0C\u539F\u5B50\u80FD\u529B C2\uFF09",
    "\u4E24\u79CD\u95EE\u6CD5\uFF1A\u628A\u67D0\u4E00\u8FB9\u901A\u5206\u540E\u53D8\u6210\u54EA\u4E2A\uFF0860%\uFF09/ \u6700\u5C0F\u516C\u5206\u6BCD\u662F\u51E0\uFF0840%\uFF09",
    "\u901A\u5206\u7B54\u6848\u4E0D\u7EA6\u5206\u2014\u2014\u5C31\u662F\u8981\u540C\u5206\u6BCD\uFF01\u672C\u9898\u5E93\u4E0D\u8003\u52A0\u51CF\u8BA1\u7B97",
    "\u500D\u6570\u5173\u7CFB\u5206\u6BCD 50% + \u4E92\u8D28\u5206\u6BCD 50%"
  ],
  timeLimitSec: 10,
  questionCount: 10,
  allowUnreduced: true,
  generators: [genCommonDenom]
};
var crossCancelSkill = {
  id: "g6-sense-crosscancel",
  title: "\u4EA4\u53C9\u7EA6\u5206",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u4E58\u6CD5\u524D\u5148\u7EA6\u5206\uFF08\u5206\u6570\u4E58\u6CD5\u7684\u901F\u7B97\u5730\u57FA\uFF09",
    "\u7ED9\u51FA\u4E58\u6CD5\u5F0F\uFF0C\u9009\u51FA\u7EA6\u5206\u540E\u7684\u5F0F\u5B50\u2014\u2014\u53EA\u7EA6\u5206\uFF0C\u4E0D\u7B97\u4E58\u79EF",
    "\u6280\u5DE7\uFF1A\u4E00\u4E2A\u6570\u7684\u5206\u5B50\u548C\u53E6\u4E00\u4E2A\u6570\u7684\u5206\u6BCD\u53EF\u4EE5\u4E92\u76F8\u7EA6",
    '\u5C0F\u5FC3"\u8FD8\u6CA1\u7EA6\u5B8C"\u7684\u9009\u9879\uFF08\u53EA\u7EA6\u4E86\u4E00\u5BF9\uFF09'
  ],
  timeLimitSec: 10,
  questionCount: 10,
  supportsReview: false,
  generators: [genCrossCancel]
};
var reciprocalSkill = {
  id: "g6-sense-reciprocal",
  title: "\u5012\u6570\u5FEB\u95EA",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u79D2\u7B54\u5012\u6570\uFF08\u9664\u6CD5\u53D8\u4E58\u6CD5\u7684\u5F00\u5173\uFF0C\u539F\u5B50\u80FD\u529B C4\uFF09",
    "\u56DB\u79CD\u5F62\u6001\uFF1A\u771F\u5206\u6570 / \u6574\u6570 / \u5C0F\u6570 / \u5E26\u5206\u6570\uFF0C30% \u662F\u8D1F\u6570",
    "\u6574\u6570 k \u7684\u5012\u6570\u662F 1/k\uFF1B\u5E26\u5206\u6570\u5148\u5316\u5047\u5206\u6570\u518D\u5012\uFF1B\u8D1F\u6570\u7684\u5012\u6570\u8FD8\u662F\u8D1F\u6570",
    "\u5C0F\u6570\u8BB0\u951A\u70B9\uFF1A0.5\u21942\u30010.25\u21944\u30010.125\u21948"
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  hideMixedKey: true,
  generators: [genReciprocal]
};
var oppositeAbsSkill = {
  id: "g6-sign-opposite",
  title: "\u76F8\u53CD\u6570\u4E0E\u7EDD\u5BF9\u503C",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u76F8\u53CD\u6570\u3001\u53BB\u62EC\u53F7\u3001\u7EDD\u5BF9\u503C\u5316\u7B80\uFF08\u6559\u6750 1.1\uFF0C\u539F\u5B50\u80FD\u529B B2\uFF09",
    "\u56DB\u79CD\u95EE\u6CD5\uFF1A\u5199\u76F8\u53CD\u6570 / -(-3) \u5316\u7B80 / |\u22125| \u5316\u7B80 / -|\u22125| \u5316\u7B80",
    "\u89C4\u5219\uFF1A\u8D1F\u8D1F\u5F97\u6B63\uFF1B\u7EDD\u5BF9\u503C\u662F\u975E\u8D1F\u7684\uFF1B\u8D1F\u53F7\u5728\u7EDD\u5BF9\u503C\u5916\u9762\u7ED3\u679C\u8FD8\u662F\u8D1F",
    "\u6574\u6570 75% + \u4E00\u4F4D\u5C0F\u6570 25%"
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genOppositeAbs]
};
var signCompareSkill = {
  id: "g6-sign-compare",
  title: "\u6B63\u8D1F\u6570\u6BD4\u5927\u5C0F",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u542B\u8D1F\u6570\u7684\u5927\u5C0F\u6BD4\u8F83\uFF08\u6559\u6750 1.1\uFF0C\u539F\u5B50\u80FD\u529B B2\uFF09",
    "\u53EA\u51FA\u540C\u5F62\u6001\u6BD4\u8F83\uFF1A\u6574\u6570 vs \u6574\u6570\u3001\u4E00\u4F4D\u5C0F\u6570 vs \u4E00\u4F4D\u5C0F\u6570",
    "\u6838\u5FC3\u76F4\u89C9\uFF1A\u8D1F\u6570\u6BD4\u8F83\uFF0C\u7EDD\u5BF9\u503C\u5927\u7684\u53CD\u800C\u5C0F\uFF08-5 < -3\uFF09",
    "\u4E00\u6210\u9898\u76EE\u4E24\u8FB9\u76F8\u7B49\uFF08-3 \u548C -3.0 \u4E00\u6837\u5927\uFF09"
  ],
  timeLimitSec: 6,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignCompare]
};
var signFlashMulSkill = {
  id: "g6-sign-flash-mul",
  title: "\u4E58\u9664\u7B26\u53F7\u5FEB\u95EA",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u4E0D\u8BA1\u7B97\uFF0C\u5224\u65AD\u4E58\u9664\u7ED3\u679C\u7684\u6B63\u8D1F\uFF08\u6559\u6750 1.3 \u7B26\u53F7\u89C4\u5219\uFF09",
    "\u53E3\u8BC0\uFF1A\u6570\u8D1F\u6570\u7684\u4E2A\u6570\u2014\u2014\u5076\u6570\u4E2A\u5F97\u6B63\uFF0C\u5947\u6570\u4E2A\u5F97\u8D1F",
    '2~4 \u4E2A\u6570\u8FDE\u4E58\u6216\u8FDE\u9664\uFF0C"\u7B49\u4E8E 0"\u6C38\u8FDC\u662F\u5E72\u6270\u9879\uFF08\u6CA1\u6709 0 \u56E0\u6570\uFF09',
    "\u9650\u65F6\u5F88\u77ED\uFF0C\u51ED\u76F4\u89C9\u79D2\u6740\uFF01\u672C\u9898\u578B\u53EA\u6709\u95EF\u5173\u548C\u8FDB\u9636\u4E24\u79CD\u6A21\u5F0F"
  ],
  timeLimitSec: 5,
  questionCount: 10,
  supportsReview: false,
  generators: [genSignFlashMul]
};
var signedMulSkill = {
  id: "g6-signed-mul",
  title: "\u6B63\u8D1F\u6570\u4E58\u9664",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u6B63\u8D1F\u6570\u4E58\u9664\u901F\u7B97\uFF08\u6559\u6750 1.3\uFF0C\u7EC4\u5408\u68C0\u9A8C\u573A\uFF09",
    "\u4E58\u6CD5 55%\uFF08\u6574\u6570 \xB19 \u5185\uFF0C25% \u4E00\u4F4D\u5C0F\u6570\xD7\u6574\u6570\uFF09+ \u9664\u6CD5 45%\uFF08\u4FDD\u8BC1\u6574\u9664\uFF09",
    "\u5148\u5B9A\u7B26\u53F7\uFF08\u540C\u53F7\u5F97\u6B63\u3001\u5F02\u53F7\u5F97\u8D1F\uFF09\uFF0C\u518D\u7B97\u7EDD\u5BF9\u503C",
    "\u590D\u4E60\u6A21\u5F0F\u952E\u76D8\u6709\u8D1F\u53F7\u952E\uFF0C\u8D1F\u6570\u7B54\u6848\u5148\u6309 \u2212 \u518D\u8F93\u6570\u5B57"
  ],
  timeLimitSec: 12,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genSignedMulDiv]
};
var genPowerFlash = (rng) => {
  rngGlobal = rng;
  const kind = rng();
  if (kind < 0.4) {
    const n = 11 + Math.floor(rng() * 10);
    const v2 = n * n;
    const traps2 = [];
    pushTextTrap(traps2, n * 20, "\u5E73\u65B9\u662F n\xD7n\uFF0C\u4E0D\u662F n\xD72", v2 * 10);
    pushTextTrap(traps2, (n - 1) * (n - 1) * 10, "\u8BB0\u5C94\u4E86\uFF1A\u8FD9\u662F\u76F8\u90BB\u7684\u5E73\u65B9\u6570", v2 * 10);
    pushTextTrap(traps2, (n + 1) * (n + 1) * 10, "\u8BB0\u5C94\u4E86\uFF1A\u8FD9\u662F\u76F8\u90BB\u7684\u5E73\u65B9\u6570", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(`${n}\xB2`), "\u79D2\u7B54", text(String(v2)), traps2);
  }
  if (kind < 0.65) {
    const n = 2 + Math.floor(rng() * 5);
    const v2 = n * n * n;
    const traps2 = [];
    pushTextTrap(traps2, n * 30, "\u7ACB\u65B9\u662F n\xD7n\xD7n\uFF0C\u4E0D\u662F n\xD73", v2 * 10);
    pushTextTrap(traps2, n * n * 10, "\u8FD9\u662F\u5E73\u65B9\uFF0C\u7ACB\u65B9\u8981\u518D\u4E58\u4E00\u4E2A n", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(`${n}\xB3`), "\u79D2\u7B54", text(String(v2)), traps2);
  }
  const sq = rng() < 0.65;
  const a = sq ? 2 + Math.floor(rng() * 8) : 2 + Math.floor(rng() * 3);
  const inParens = rng() < 0.5;
  if (sq) {
    const v2 = inParens ? a * a : -a * a;
    const traps2 = [];
    pushTextTrap(traps2, -v2 * 10, inParens ? "\u8D1F\u6570\u7684\u5E73\u65B9\u662F\u6B63\u6570" : "\u8D1F\u53F7\u5728\u5E73\u65B9\u5916\u9762\uFF1A\u5148\u7B97\u5E73\u65B9\u518D\u6DFB\u8D1F\u53F7", v2 * 10);
    pushTextTrap(traps2, (inParens ? a * 2 : -a * 2) * 10, "\u5E73\u65B9\u662F a\xD7a\uFF0C\u4E0D\u662F a\xD72", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(inParens ? `(-${a})\xB2` : `-${a}\xB2`), "\u8BA1\u7B97\uFF08\u770B\u6E05\u8D1F\u53F7\u4F4D\u7F6E\uFF09", text(String(v2)), traps2);
  }
  const v = -a * a * a;
  const traps = [];
  pushTextTrap(traps, -v * 10, "\u8D1F\u6570\u7684\u7ACB\u65B9\u8FD8\u662F\u8D1F\u6570\uFF08\u4E09\u4E2A\u8D1F\u53F7\uFF09", v * 10);
  pushTextTrap(traps, a * 30, "\u7ACB\u65B9\u662F a\xD7a\xD7a\uFF0C\u4E0D\u662F a\xD73", v * 10);
  fillTextTraps(traps, v * 10);
  return makeQuestion(text(`(-${a})\xB3`), "\u8BA1\u7B97\uFF08\u770B\u6E05\u7B26\u53F7\uFF09", text(String(v)), traps);
};
var red = (n, d) => {
  const g = gcd(Math.abs(n), Math.abs(d)) || 1;
  return [n / g, d / g];
};
var rAdd = (x, y) => red(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
var rSub = (x, y) => red(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
var rMul = (x, y) => red(x[0] * y[0], x[1] * y[1]);
var rDiv = (x, y) => red(x[0] * y[1], x[1] * y[0]);
var rVal = (x) => x[0] / x[1];
var isDecDenom = (d) => {
  let x = d;
  while (x % 2 === 0)
    x /= 2;
  while (x % 5 === 0)
    x /= 5;
  return x === 1;
};
function fmtRat(x) {
  const [n, d] = red(x[0], x[1]);
  if (n === 0)
    return text("0");
  if (d === 1)
    return text(String(n));
  if (isDecDenom(d))
    return text(String(parseFloat((n / d).toFixed(6))));
  if (n > d)
    return mixed(Math.floor(n / d), n % d, d);
  return frac(n, d);
}
var DEC_ANCHORS = [
  ["0.5", 1, 2],
  ["0.25", 1, 4],
  ["0.2", 1, 5],
  ["0.125", 1, 8],
  ["0.75", 3, 4],
  ["0.4", 2, 5],
  ["0.6", 3, 5],
  ["1.5", 3, 2],
  ["1.25", 5, 4],
  ["2.5", 5, 2]
];
var WRONG_ANCHOR = {
  "0.25": [1, 5],
  "0.2": [1, 4],
  "0.125": [1, 4],
  "0.5": [1, 4],
  "0.75": [3, 5],
  "0.4": [1, 4],
  "0.6": [3, 4],
  "1.25": [3, 2]
};
var genFracDecMix = (rng) => {
  rngGlobal = rng;
  const [decS, dn, dd] = pick(rng, DEC_ANCHORS);
  const b = pick(rng, [2, 3, 4, 5, 6, 8, 9]);
  const an = randomNumerator(rng, b);
  const F = [an, b];
  const D = [dn, dd];
  let op = pick(rng, ["+", "-", "\xD7", "\xF7"]);
  let terms;
  let res;
  let swapped = false;
  if (op === "-" && Math.abs(rVal(F) - rVal(D)) < 1e-9)
    op = "+";
  if (op === "+") {
    terms = [frac(an, b), text(decS)];
    res = rAdd(F, D);
  } else if (op === "\xD7") {
    terms = [frac(an, b), text(decS)];
    res = rMul(F, D);
  } else if (op === "-") {
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
  const traps = [];
  const seen = /* @__PURE__ */ new Set([ansKey]);
  const pushRat = (x, trap) => {
    if (x[0] <= 0)
      return;
    const t = fmtRat(x);
    const k = exprKey(t);
    if (seen.has(k))
      return;
    seen.add(k);
    traps.push({ value: t, trap });
  };
  if (op === "\xF7")
    pushRat(swapped ? rDiv(F, D) : rDiv(D, F), "\u88AB\u9664\u6570\u548C\u9664\u6570\u7684\u4F4D\u7F6E\u8981\u770B\u6E05");
  if (op === "-")
    pushRat(swapped ? rSub(F, D) : rSub(D, F), "\u8C01\u51CF\u8C01\u8981\u770B\u6E05\uFF08\u672C\u9898\u7ED3\u679C\u4E3A\u6B63\uFF09");
  const wa = WRONG_ANCHOR[decS];
  if (wa) {
    const W = wa;
    const wrongRes = op === "+" ? rAdd(F, W) : op === "\xD7" ? rMul(F, W) : op === "-" ? rSub(F, W) : rDiv(F, W);
    pushRat(wrongRes, `\u5C0F\u6570\u8F6C\u5206\u6570\u8BB0\u9519\u4E86\uFF1A${decS} \u4E0D\u662F ${wa[0]}/${wa[1]}`);
  }
  {
    const altOp = pick(rng, ["+", "-", "\xD7", "\xF7"].filter((o) => o !== op));
    const alt = altOp === "+" ? rAdd(F, D) : altOp === "\xD7" ? rMul(F, D) : altOp === "-" ? rSub(F, D) : rDiv(F, D);
    pushRat(alt, `\u8FD9\u662F\u6309 ${altOp} \u7B97\u7684\uFF0C\u770B\u6E05\u8FD0\u7B97\u7B26\u53F7`);
  }
  for (const [nn, dd2] of [
    [res[0] + 1, res[1]],
    [res[0] - 1, res[1]],
    [res[0], res[1] + 1],
    [res[0] * 2, res[1]],
    [res[0] + 2, res[1]]
  ]) {
    if (traps.length >= 3)
      break;
    if (nn <= 0 || dd2 < 1)
      continue;
    pushRat([nn, dd2], "\u5DEE\u4E00\u70B9\u70B9\uFF0C\u518D\u4ED4\u7EC6\u7B97\u4E00\u904D");
  }
  return makeQuestion(
    { kind: "op", op, terms },
    "\u8BA1\u7B97\uFF08\u7ED3\u679C\u7EA6\u5230\u6700\u7B80\uFF0C\u5047\u5206\u6570\u6216\u5E26\u5206\u6570\u5747\u53EF\uFF09",
    ans,
    traps
  );
};
var genOpOrder = (rng) => {
  rngGlobal = rng;
  const nums = /* @__PURE__ */ new Set();
  while (nums.size < 4)
    nums.add(2 + Math.floor(rng() * 14));
  const [A, B, C, D] = [...nums];
  const form = Math.floor(rng() * 6);
  let expr, step;
  let traps;
  if (form === 0) {
    expr = `${A} + ${B} \xD7 ${C}`;
    step = `${B} \xD7 ${C}`;
    traps = [
      { value: text(`${A} + ${B}`), trap: "\u5148\u4E58\u9664\u540E\u52A0\u51CF\uFF1A\u4E58\u6CD5\u662F B \u548C C \u4E4B\u95F4\u7684" },
      { value: text(`${A} + ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u4E58\u6CD5\u5728\u4E2D\u95F4\u7684 B \u548C C \u4E4B\u95F4" },
      { value: text(`${B} + ${C}`), trap: "\u7B26\u53F7\u770B\u9519\u4E86\uFF0C\u4E2D\u95F4\u662F\u4E58\u53F7" }
    ];
  } else if (form === 1) {
    expr = `${A} - ${B} \xF7 ${C}`;
    step = `${B} \xF7 ${C}`;
    traps = [
      { value: text(`${A} - ${B}`), trap: "\u5148\u4E58\u9664\u540E\u52A0\u51CF\uFF1A\u9664\u6CD5\u662F B \u548C C \u4E4B\u95F4\u7684" },
      { value: text(`${A} \xF7 ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u9664\u6CD5\u5728 B \u548C C \u4E4B\u95F4" },
      { value: text(`${B} - ${C}`), trap: "\u7B26\u53F7\u770B\u9519\u4E86\uFF0C\u4E2D\u95F4\u662F\u9664\u53F7" }
    ];
  } else if (form === 2) {
    expr = `(${A} + ${B}) \xD7 ${C}`;
    step = `${A} + ${B}`;
    traps = [
      { value: text(`${B} \xD7 ${C}`), trap: "\u62EC\u53F7\u91CC\u7684\u8981\u6700\u5148\u7B97" },
      { value: text(`${A} \xD7 ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u62EC\u53F7\u4F18\u5148" },
      { value: text(`${B} + ${C}`), trap: "\u62EC\u53F7\u4F18\u5148\uFF0C\u5148\u7B97\u62EC\u53F7\u91CC\u9762" }
    ];
  } else if (form === 3) {
    expr = `${A} \xD7 (${B} - ${C})`;
    step = `${B} - ${C}`;
    traps = [
      { value: text(`${A} \xD7 ${B}`), trap: "\u62EC\u53F7\u91CC\u7684\u8981\u6700\u5148\u7B97" },
      { value: text(`${A} - ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u62EC\u53F7\u4F18\u5148" },
      { value: text(`${B} \xD7 ${C}`), trap: "\u7B26\u53F7\u770B\u9519\u4E86\uFF0C\u62EC\u53F7\u91CC\u662F\u51CF\u53F7" }
    ];
  } else if (form === 4) {
    expr = `${A} \xF7 ${B} \xD7 ${C}`;
    step = `${A} \xF7 ${B}`;
    traps = [
      { value: text(`${B} \xD7 ${C}`), trap: "\u4E58\u9664\u540C\u7EA7\u8981\u4ECE\u5DE6\u5F80\u53F3\u7B97" },
      { value: text(`${A} \xD7 ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u540C\u7EA7\u4ECE\u5DE6\u5F80\u53F3" },
      { value: text(`${A} \xF7 ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u540C\u7EA7\u4ECE\u5DE6\u5F80\u53F3" }
    ];
  } else {
    expr = `${A} + ${B} - ${C} + ${D}`;
    step = `${A} + ${B}`;
    traps = [
      { value: text(`${B} - ${C}`), trap: "\u52A0\u51CF\u540C\u7EA7\u8981\u4ECE\u5DE6\u5F80\u53F3\uFF0C\u7B2C\u4E00\u6B65\u5728\u6700\u5DE6\u8FB9" },
      { value: text(`${C} + ${D}`), trap: "\u52A0\u51CF\u540C\u7EA7\u8981\u4ECE\u5DE6\u5F80\u53F3\uFF0C\u7B2C\u4E00\u6B65\u5728\u6700\u5DE6\u8FB9" },
      { value: text(`${A} + ${C}`), trap: "\u4E71\u914D\u4E86\uFF1A\u540C\u7EA7\u4ECE\u5DE6\u5F80\u53F3" }
    ];
  }
  return makeQuestion(text(expr), "\u5148\u7B97\u54EA\u4E00\u6B65\uFF1F", text(step), traps);
};
var genOpLaws = (rng) => {
  rngGlobal = rng;
  if (rng() < 0.4) {
    const PAIRS = [
      ["0.25", "4"],
      ["2.5", "4"],
      ["0.125", "8"],
      ["25", "4"],
      ["125", "8"],
      ["0.5", "2"]
    ];
    const [xs, ys] = pick(rng, PAIRS);
    const banned = /* @__PURE__ */ new Set([parseFloat(xs), parseFloat(ys)]);
    let a = 3 + Math.floor(rng() * 30);
    for (let t2 = 0; t2 < 40 && banned.has(a); t2++)
      a = 3 + Math.floor(rng() * 30);
    if (banned.has(a))
      a = 33;
    const traps2 = [
      { value: text(`${xs} \xD7 ${a}`), trap: "\u6309\u987A\u5E8F\u786C\u7B97\u7B2C\u4E00\u6B65\uFF0C\u6162\u8FD8\u5BB9\u6613\u9519" },
      { value: text(`${a} \xD7 ${ys}`), trap: "\u8FD9\u4E00\u6B65\u51D1\u4E0D\u51FA\u6574\uFF1A\u627E\u4E58\u8D77\u6765\u662F\u6574\u5341\u6574\u767E\u7684\u4E24\u4E2A\u6570" },
      { value: text(`${xs} + ${ys}`), trap: "\u662F\u8FDE\u4E58\u4E0D\u662F\u52A0\u6CD5" }
    ];
    return makeQuestion(
      text(`${xs} \xD7 ${a} \xD7 ${ys}`),
      "\u600E\u4E48\u7B97\u6700\u5FEB\uFF1F\u7B2C\u4E00\u6B65\u9009\u54EA\u4E2A",
      text(`${xs} \xD7 ${ys}`),
      traps2
    );
  }
  const t = rng();
  if (t < 0.2) {
    const k = 3 + Math.floor(rng() * 10);
    const v2 = 100 * k;
    const traps2 = [];
    pushTextTrap(traps2, 100 * (k - 1) * 10, "\u5C11\u6570\u4E86\u4E00\u7EC4 25\xD74=100", v2 * 10);
    pushTextTrap(traps2, 100 * (k + 1) * 10, "\u591A\u6570\u4E86\u4E00\u7EC4 25\xD74=100", v2 * 10);
    pushTextTrap(traps2, (v2 - 50) * 10, "\u628A 32 \u62C6\u6210 4\xD78 \u518D\u7B97\uFF1A25\xD74=100", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(`25 \xD7 ${4 * k}`), "\u8BA1\u7B97\uFF08\u51D1\u6574\u6700\u5FEB\uFF09", text(String(v2)), traps2);
  }
  if (t < 0.4) {
    const k = 2 + Math.floor(rng() * 5);
    const v2 = 1e3 * k;
    const traps2 = [];
    pushTextTrap(traps2, 1e3 * (k - 1) * 10, "\u5C11\u6570\u4E86\u4E00\u7EC4 125\xD78=1000", v2 * 10);
    pushTextTrap(traps2, 1e3 * (k + 1) * 10, "\u591A\u6570\u4E86\u4E00\u7EC4 125\xD78=1000", v2 * 10);
    pushTextTrap(traps2, (v2 - 500) * 10, "\u628A\u4E58\u6570\u62C6\u51FA 8\uFF1A125\xD78=1000", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(`125 \xD7 ${8 * k}`), "\u8BA1\u7B97\uFF08\u51D1\u6574\u6700\u5FEB\uFF09", text(String(v2)), traps2);
  }
  if (t < 0.65) {
    const near100 = rng() < 0.5 ? 99 : 101;
    const m2 = 3 + Math.floor(rng() * 7);
    const v2 = near100 * m2;
    const traps2 = [];
    pushTextTrap(traps2, 100 * m2 * 10, near100 === 99 ? "99\xD7m = 100\xD7m \u2212 m\uFF0C\u8FD8\u8981\u51CF\u4E00\u4E2A m" : "101\xD7m = 100\xD7m + m\uFF0C\u8FD8\u8981\u52A0\u4E00\u4E2A m", v2 * 10);
    pushTextTrap(traps2, (near100 === 99 ? 98 * m2 : 102 * m2) * 10, near100 === 99 ? "\u591A\u51CF\u4E86\u4E00\u4E2A m" : "\u591A\u52A0\u4E86\u4E00\u4E2A m", v2 * 10);
    pushTextTrap(traps2, 90 * m2 * 10, "\u628A\u63A5\u8FD1 100 \u7684\u6570\u5F53 100 \u7B97\u518D\u8C03\u6574", v2 * 10);
    fillTextTraps(traps2, v2 * 10);
    return makeQuestion(text(`${near100} \xD7 ${m2}`), "\u8BA1\u7B97\uFF08\u51D1\u6574\u6700\u5FEB\uFF09", text(String(v2)), traps2);
  }
  if (t < 0.85) {
    const PAIRS = [[46, 54], [88, 12], [125, 75], [37, 63], [99, 1], [25, 75]];
    const [x, z] = pick(rng, PAIRS);
    const y = 11 + Math.floor(rng() * 88);
    const v2 = x + y + z;
    const traps2 = [];
    pushTextTrap(traps2, v2 - 10, "\u5C0F\u6570\u70B9\u5BF9\u9F50\u9519\uFF0C\u5DEE 1", v2);
    pushTextTrap(traps2, v2 + 10, "\u5C0F\u6570\u70B9\u5BF9\u9F50\u9519\uFF0C\u5DEE 1", v2);
    pushTextTrap(traps2, x + z + y - 2, "\u8FDB\u4F4D\u7B97\u9519\u4E86", v2);
    fillTextTraps(traps2, v2);
    return makeQuestion(
      text(`${fmtTenth(x)} + ${fmtTenth(y)} + ${fmtTenth(z)}`),
      "\u8BA1\u7B97\uFF08\u5148\u627E\u80FD\u51D1\u6574\u7684\u4E24\u4E2A\u6570\uFF09",
      text(fmtTenth(v2)),
      traps2
    );
  }
  const base = pick(rng, [198, 298, 397, 495, 599, 697]);
  const gap = base % 100 === 99 || base % 100 === 95 ? 100 - base % 100 : base % 100 === 97 ? 3 : 100 - base % 100;
  const round = base + gap;
  const m = 20 + Math.floor(rng() * 70);
  const v = base + m;
  const traps = [];
  pushTextTrap(traps, (round + m) * 10, `\u628A ${base} \u5F53 ${round} \u52A0\u4E86\uFF0C\u522B\u5FD8\u4E86\u518D\u51CF ${gap}`, v * 10);
  pushTextTrap(traps, (round + m - 2 * gap) * 10, "\u8C03\u6574\u65B9\u5411\u53CD\u4E86", v * 10);
  pushTextTrap(traps, (v + 10) * 10, "\u5341\u4F4D\u8FDB\u4F4D\u7B97\u9519\u4E86", v * 10);
  fillTextTraps(traps, v * 10);
  return makeQuestion(text(`${base} + ${m}`), "\u8BA1\u7B97\uFF08\u51D1\u6574\u6700\u5FEB\uFF09", text(String(v)), traps);
};
var powerFlashSkill = {
  id: "g6-power-flash",
  title: "\u4E58\u65B9\u901F\u8BB0",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5E73\u65B9/\u7ACB\u65B9\u79D2\u7B54 + \u8D1F\u53F7\u4F4D\u7F6E\u8FA8\u6790\uFF08\u6559\u6750 1.4\uFF09",
    "\u5E73\u65B9 11\xB2~20\xB2\uFF0840%\uFF09\u3001\u7ACB\u65B9 2\xB3~6\xB3\uFF0825%\uFF09",
    "\u7B26\u53F7\u9677\u9631 35%\uFF1A(-3)\xB2 = 9 \u4F46 -3\xB2 = -9\uFF0C\u8D1F\u53F7\u5728\u62EC\u53F7\u5916\u5148\u7B97\u5E73\u65B9\uFF01",
    "\u590D\u4E60\u6A21\u5F0F\u952E\u76D8\u6709\u8D1F\u53F7\u952E"
  ],
  timeLimitSec: 6,
  questionCount: 10,
  allowNegative: true,
  numericKeypad: true,
  generators: [genPowerFlash]
};
var fracDecMixSkill = {
  id: "g6-frac-dec-mix",
  title: "\u5206\u6570\u5C0F\u6570\u6DF7\u5408\u7B97",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u5206\u6570\u4E0E\u5C0F\u6570\u7684\u6DF7\u5408\u56DB\u5219\uFF08\u6559\u6750 1.5\uFF0C\u7EC4\u5408\u68C0\u9A8C\u573A\uFF09",
    "\u52A0/\u51CF/\u4E58/\u9664\u5404 25%\uFF0C\u4E24\u9879\u8BA1\u7B97\uFF1B\u5C0F\u6570\u5168\u90E8\u6765\u81EA\u951A\u70B9\u8868\uFF080.125~2.5\uFF09",
    "\u7B54\u6848\u81EA\u52A8\u9009\u6700\u597D\u770B\u7684\u5F62\u6001\uFF1A\u80FD\u5199\u5C0F\u6570\u5199\u5C0F\u6570\uFF0C\u5426\u5219\u6700\u7B80\u5206\u6570/\u5E26\u5206\u6570",
    '\u51CF\u6CD5\u4FDD\u8BC1\u7ED3\u679C\u4E3A\u6B63\uFF1B\u5C0F\u5FC3"\u65B9\u5411\u53CD\u4E86"\u548C"0.25 \u8BB0\u6210 1/5"\u7684\u5E72\u6270\u9879'
  ],
  timeLimitSec: 18,
  questionCount: 10,
  acceptImproper: true,
  generators: [genFracDecMix]
};
var opOrderSkill = {
  id: "g6-op-order",
  title: "\u8FD0\u7B97\u987A\u5E8F",
  intro: [
    '\u8003\u6838\u70B9\uFF1A\u53EA\u5224\u65AD"\u5148\u7B97\u54EA\u4E00\u6B65"\uFF0C\u4E0D\u8BA1\u7B97\uFF08\u6559\u6750 1.5\uFF09',
    "\u4E09\u6761\u89C4\u5219\uFF1A\u62EC\u53F7\u4F18\u5148 \u2192 \u5148\u4E58\u9664\u540E\u52A0\u51CF \u2192 \u540C\u7EA7\u4ECE\u5DE6\u5F80\u53F3",
    '\u5E72\u6270\u9879\u90FD\u662F"\u770B\u8D77\u6765\u987A\u624B"\u7684\u9519\u8BEF\u7B2C\u4E00\u6B65',
    "\u672C\u9898\u578B\u53EA\u6709\u95EF\u5173\u548C\u8FDB\u9636\u4E24\u79CD\u6A21\u5F0F"
  ],
  timeLimitSec: 8,
  questionCount: 10,
  supportsReview: false,
  generators: [genOpOrder]
};
var opLawsSkill = {
  id: "g6-op-laws",
  title: "\u51D1\u6574\u5DE7\u7B97",
  intro: [
    "\u8003\u6838\u70B9\uFF1A\u9009\u6700\u806A\u660E\u7684\u7B97\u6CD5\uFF0C\u4E0D\u786C\u7B97\uFF08\u8FD0\u7B97\u5F8B\u8FD0\u7528\uFF09",
    "40% \u9009\u7B2C\u4E00\u6B65\uFF1A\u8FDE\u4E58\u91CC\u627E\u4E58\u8D77\u6765\u662F\u6574\u5341\u6574\u767E\u7684\u4E24\u4E2A\u6570\uFF080.25\xD74\u3001125\xD78\uFF09",
    "60% \u51D1\u6574\u6C42\u503C\uFF1A25\xD732\u300199\xD77\u30014.6+5.7+5.4\u3001198+76",
    "\u672C\u9898\u578B\u53EA\u6709\u95EF\u5173\u548C\u8FDB\u9636\u4E24\u79CD\u6A21\u5F0F"
  ],
  timeLimitSec: 10,
  questionCount: 10,
  supportsReview: false,
  generators: [genOpLaws]
};
var GRADES = [
  {
    id: "g5",
    title: "\u4E94\u5E74\u7EA7 \xB7 \u5206\u6570\u4E0E\u5C0F\u6570",
    available: true,
    units: [
      { id: "g5-frac-meaning", title: "5.1 \u5206\u6570\u7684\u610F\u4E49\u4E0E\u6539\u5199", skills: [rewriteSkill] },
      { id: "g5-frac-simplify", title: "5.2 \u7EA6\u5206", skills: [simplifySkill] },
      { id: "g5-frac-lcd", title: "5.3 \u901A\u5206", skills: [lcdSkill] },
      { id: "g5-frac-compare", title: "5.4 \u5206\u6570\u7684\u5927\u5C0F\u6BD4\u8F83", skills: [compareSkill] },
      { id: "g5-frac-addsub", title: "5.5 \u5206\u6570\u7684\u52A0\u51CF\u6CD5", skills: [fracAddSkill, fracSubSkill] },
      { id: "g5-frac-mul", title: "5.6 \u5206\u6570\u7684\u4E58\u6CD5", skills: [fracMulSkill, crossCancelSkill] },
      { id: "g5-frac-div", title: "5.7 \u5206\u6570\u7684\u9664\u6CD5", skills: [reciprocalSkill, fracDivSkill] },
      { id: "g5-frac-dec", title: "5.8 \u5206\u6570\u4E0E\u5C0F\u6570", skills: [rationalConvertSkill, fracDecMixSkill] }
    ]
  },
  {
    id: "g6",
    title: "\u516D\u5E74\u7EA7\u4E0A \xB7 \u7B2C1\u7AE0 \u6709\u7406\u6570",
    available: true,
    units: [
      { id: "g6-1-1", title: "1.1 \u6709\u7406\u6570\u7684\u5F15\u5165", skills: [oppositeAbsSkill, signCompareSkill] },
      { id: "g6-1-2", title: "1.2 \u6709\u7406\u6570\u7684\u52A0\u6CD5\u4E0E\u51CF\u6CD5", skills: [signFlashSkill, signedAddSkill] },
      { id: "g6-1-3", title: "1.3 \u6709\u7406\u6570\u7684\u4E58\u6CD5\u4E0E\u9664\u6CD5", skills: [signFlashMulSkill, signedMulSkill] },
      { id: "g6-1-4", title: "1.4 \u6709\u7406\u6570\u7684\u4E58\u65B9", skills: [powerFlashSkill] },
      { id: "g6-1-5", title: "1.5 \u6709\u7406\u6570\u7684\u6DF7\u5408\u8FD0\u7B97", skills: [opOrderSkill, opLawsSkill] }
    ]
  },
  {
    id: "g6b",
    title: "\u516D\u5E74\u7EA7\u4E0B",
    available: true,
    units: [{ id: "g6b-5-2", title: "5.2 \u767E\u5206\u6570", skills: [] }]
  },
  { id: "g7", title: "\u4E03\u5E74\u7EA7", available: false, units: [] },
  { id: "g8", title: "\u516B\u5E74\u7EA7", available: false, units: [] },
  { id: "g9", title: "\u4E5D\u5E74\u7EA7", available: false, units: [] }
];
function findSkill(skillId) {
  for (const g of GRADES)
    for (const u of g.units)
      for (const s of u.skills)
        if (s.id === skillId)
          return s;
  return void 0;
}
function generateQuiz(skill, seed = Date.now(), count) {
  const rng = mulberry32(seed);
  const total = count ?? skill.questionCount;
  return Array.from(
    { length: total },
    (_, i) => skill.generators[i % skill.generators.length](rng)
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GRADES,
  exprKey,
  exprValue,
  findSkill,
  generateQuiz,
  modeParams,
  mulberry32
});
