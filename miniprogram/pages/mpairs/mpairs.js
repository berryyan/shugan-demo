const { findGame } = require('../../core/games.js');
const { getWallet, spendPoints, addPoints } = require('../../core/wallet.js');
const { GRADE_POINTS, getProgress, recordGrade, gradeHigherIsBetter } = require('../../core/levels.js');
const { submitScore } = require('../../core/leaderboard.js');
const { exprToTokens } = require('../../core/tokens.js');

const META = findGame('match-pairs');
const ROUND_MS = 60000;
const WRONG_PENALTY_MS = 2000; // 配错扣 2 秒：防瞎点

/** 关卡配置：牌数 + 可用形态 + 评级线（60 秒配对数，越多越好） */
const LEVELS = [
  { cards: 4, forms: ['frac', 'decimal'], t: [12, 10, 8, 7, 6, 5] },
  { cards: 4, forms: ['frac', 'decimal', 'unreduced'], t: [11, 9, 8, 7, 6, 5] },
  { cards: 4, forms: ['frac', 'decimal', 'unreduced', 'percent'], t: [11, 9, 8, 7, 6, 5] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent'], t: [10, 9, 8, 6, 5, 4] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent', 'mixed', 'improper'], t: [10, 9, 8, 6, 5, 4] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent', 'mixed', 'improper'], t: [12, 10, 9, 7, 6, 5] },
];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const DENOMS = [2, 4, 5, 8, 10];

/** 全部数值家族：小于 1 的真分数族 + 大于 1 的带分数族（分母保证除得尽） */
const FAMILIES = (() => {
  const list = [];
  for (const d of DENOMS)
    for (let n = 1; n < d; n++)
      if (gcd(n, d) === 1) list.push({ value: n / d, big: false, w: 0, n, d });
  for (const w of [1, 2])
    for (const d of DENOMS)
      for (let n = 1; n < d; n++)
        if (gcd(n, d) === 1) list.push({ value: w + n / d, big: true, w, n, d });
  return list;
})();

function decimalText(f) {
  const scaled = f.w * 1000 + f.n * (1000 / f.d);
  const s = String(scaled).padStart(4, '0');
  return `${s.slice(0, -3)}.${s.slice(-3)}`.replace(/0+$/, '').replace(/\.$/, '');
}

function applicableForms(f) {
  return f.big ? ['mixed', 'decimal', 'improper', 'percent'] : ['frac', 'decimal', 'unreduced', 'percent'];
}

function renderForm(f, form) {
  switch (form) {
    case 'frac':
      return { kind: 'frac', n: String(f.n), d: String(f.d) };
    case 'unreduced': {
      const k = f.d <= 4 ? 3 : 2;
      return { kind: 'frac', n: String(f.n * k), d: String(f.d * k) };
    }
    case 'decimal':
      return { kind: 'text', text: decimalText(f) };
    case 'percent':
      return { kind: 'text', text: `${f.value * 100}%` };
    case 'mixed':
      return { kind: 'mixed', whole: String(f.w), n: String(f.n), d: String(f.d) };
    case 'improper':
      return { kind: 'frac', n: String(f.w * f.d + f.n), d: String(f.d) };
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 生成一局牌：恰好一对等值，其余互不相等 */
function genRound(cfg) {
  const pool = shuffle(FAMILIES.filter((f) => applicableForms(f).filter((x) => cfg.forms.includes(x)).length >= 1));
  let pairFam;
  let pairForms = [];
  for (const f of pool) {
    const forms = applicableForms(f).filter((x) => cfg.forms.includes(x));
    if (forms.length >= 2) {
      pairFam = f;
      pairForms = shuffle(forms).slice(0, 2);
      break;
    }
  }
  if (!pairFam) return [];
  const cards = pairForms.map((form, i) => ({ id: i, expr: renderForm(pairFam, form), value: pairFam.value }));
  const used = new Set([pairFam.value]);
  for (const f of pool) {
    if (cards.length >= cfg.cards) break;
    if (used.has(f.value)) continue;
    const forms = applicableForms(f).filter((x) => cfg.forms.includes(x));
    if (!forms.length) continue;
    used.add(f.value);
    cards.push({ id: cards.length, expr: renderForm(f, forms[0]), value: f.value });
  }
  return shuffle(cards).map((c, i) => ({ ...c, id: i, tokens: exprToTokens(c.expr) }));
}

Page({
  data: {
    meta: META,
    points: 0,
    level: 0,
    phase: 'pick', // pick | play | over
    cards: [],
    selected: -1,
    pairs: 0,
    leftSec: 60,
    barPct: 100,
    barRed: false,
    flash: '', // '' | good | bad
    grade: '',
    reward: 0,
    finalPairs: 0,
    unlocked: 0,
    levelCards: [],
    feeOk: false,
    newUnlock: false,
  },

  onLoad(options) {
    const lv = Math.min(Math.max(Number(options.level || 0) || 0, 0), 5);
    this.refresh(lv);
  },

  onUnload() {
    this.clearTimers();
  },

  clearTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.timer = this.flashTimer = null;
  },

  refresh(level) {
    const prog = getProgress(META.id);
    const points = getWallet().points;
    const lv = level !== undefined ? level : this.data.level;
    this.setData({
      level: lv,
      points,
      unlocked: prog.unlocked,
      feeOk: points >= META.entryFee,
      levelCards: META.levels.map((l, i) => ({
        title: l.title,
        hint: l.hint,
        locked: i > prog.unlocked,
        grade: prog.grades[String(i)] || '',
        active: i === lv,
      })),
    });
  },

  pickLevel(e) {
    const i = e.currentTarget.dataset.i;
    if (i > getProgress(META.id).unlocked) return;
    this.refresh(i);
  },

  startGame() {
    if (!spendPoints(META.entryFee)) return;
    this.clearTimers();
    this.pairsCount = 0;
    this.endAt = Date.now() + ROUND_MS;
    this.setData({
      points: getWallet().points,
      pairs: 0,
      selected: -1,
      flash: '',
      grade: '',
      leftSec: 60,
      barPct: 100,
      barRed: false,
      cards: genRound(LEVELS[this.data.level]),
      phase: 'play',
    });
    this.timer = setInterval(() => {
      const left = this.endAt - Date.now();
      const clamped = Math.max(0, left);
      this.setData({
        leftSec: Math.ceil(clamped / 1000),
        barPct: (clamped / ROUND_MS) * 100,
        barRed: clamped <= 10000,
      });
      if (left <= 0) this.finish();
    }, 100);
  },

  tapCard(e) {
    if (this.data.phase !== 'play' || this.data.flash) return;
    const c = this.data.cards[e.currentTarget.dataset.i];
    if (this.data.selected === -1) {
      this.setData({ selected: c.id });
      return;
    }
    if (this.data.selected === c.id) {
      this.setData({ selected: -1 });
      return;
    }
    const first = this.data.cards.find((x) => x.id === this.data.selected);
    this.setData({ selected: -1 });
    if (Math.abs(first.value - c.value) < 1e-9) {
      this.pairsCount += 1;
      this.setData({ pairs: this.pairsCount, flash: 'good' });
      wx.vibrateShort({ type: 'light' });
      this.flashTimer = setTimeout(() => {
        this.setData({ flash: '', cards: genRound(LEVELS[this.data.level]) });
      }, 350);
    } else {
      this.endAt -= WRONG_PENALTY_MS;
      this.setData({ flash: 'bad' });
      this.flashTimer = setTimeout(() => this.setData({ flash: '' }), 350);
    }
  },

  finish() {
    this.clearTimers();
    const cfg = LEVELS[this.data.level];
    const g = gradeHigherIsBetter(this.pairsCount, cfg.t);
    const prevUnlocked = getProgress(META.id).unlocked;
    recordGrade(META.id, this.data.level, g);
    const reward = GRADE_POINTS[g];
    submitScore(META.id, '我', this.pairsCount);
    if (reward > 0) addPoints(reward);
    const prog = getProgress(META.id);
    this.setData({
      grade: g,
      reward,
      phase: 'over',
      finalPairs: this.pairsCount,
      points: getWallet().points,
      unlocked: prog.unlocked,
      newUnlock: g !== 'F' && prog.unlocked > prevUnlocked && this.data.level < 5,
    });
  },

  again() {
    this.refresh();
    this.setData({ phase: 'pick' });
  },

  goHall() {
    wx.navigateBack();
  },
});
