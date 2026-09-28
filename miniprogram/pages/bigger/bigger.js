const { findGame } = require('../../core/games.js');
const { getWallet, spendPoints, addPoints } = require('../../core/wallet.js');
const { GRADE_POINTS, getProgress, recordGrade, gradeLowerIsBetter } = require('../../core/levels.js');
const { submitScore } = require('../../core/leaderboard.js');
const { exprToTokens } = require('../../core/tokens.js');

const META = findGame('bigger-tap');
const WRONG_PENALTY_MS = 2000; // 点错按 2 秒计入：乱猜平均成绩必炸

/** 关卡配置：题数 + 分母池 + 跨形态概率 + 差值区间 + 评级线（平均反应 ms，越小越好） */
const LEVELS = [
  { rounds: 10, denoms: [2, 4, 5, 8, 10], cross: 0.3, minDiff: 0.1, maxDiff: 0.5, t: [1300, 1600, 2000, 2500, 3100, 3800] },
  { rounds: 10, denoms: [2, 4, 5, 8, 10], cross: 0.5, minDiff: 0.08, maxDiff: 0.4, t: [1200, 1500, 1900, 2400, 3000, 3600] },
  { rounds: 12, denoms: [2, 3, 4, 5, 8, 10], cross: 0.5, minDiff: 0.06, maxDiff: 0.35, t: [1100, 1400, 1800, 2300, 2900, 3500] },
  { rounds: 12, denoms: [2, 3, 4, 5, 6, 8, 9, 10], cross: 0.4, minDiff: 0.05, maxDiff: 0.3, t: [1100, 1400, 1800, 2300, 2900, 3500] },
  { rounds: 15, denoms: [2, 3, 4, 5, 6, 8, 9, 10], cross: 0.5, minDiff: 0.04, maxDiff: 0.28, t: [1000, 1300, 1700, 2200, 2800, 3400] },
  { rounds: 15, denoms: [2, 3, 4, 5, 6, 7, 8, 9, 10], cross: 0.5, minDiff: 0.03, maxDiff: 0.25, t: [950, 1250, 1650, 2100, 2700, 3300] },
];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const DECIMAL_OK = [2, 4, 5, 8, 10];

function coprimeNumerators(d) {
  const list = [];
  for (let n = 1; n < d; n++) if (gcd(n, d) === 1) list.push(n);
  return list;
}

function decimalText(n, d) {
  const scaled = n * (1000 / d);
  const s = String(scaled).padStart(4, '0');
  return `${s.slice(0, -3)}.${s.slice(-3)}`.replace(/0+$/, '').replace(/\.$/, '');
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** 生成一对"接近但不同"的值：差值落在 [minDiff, maxDiff]，逼出数感而非硬算 */
function genPair(cfg) {
  for (let tries = 0; tries < 100; tries++) {
    const d1 = pick(cfg.denoms);
    const d2 = pick(cfg.denoms);
    const n1 = pick(coprimeNumerators(d1));
    const n2 = pick(coprimeNumerators(d2));
    const v1 = n1 / d1;
    const v2 = n2 / d2;
    const diff = Math.abs(v1 - v2);
    if (diff < cfg.minDiff || diff > cfg.maxDiff) continue;
    const right =
      Math.random() < cfg.cross && DECIMAL_OK.includes(d2)
        ? { kind: 'text', text: decimalText(n2, d2) }
        : { kind: 'frac', n: String(n2), d: String(d2) };
    return { left: { kind: 'frac', n: String(n1), d: String(d1) }, right, vL: v1, vR: v2 };
  }
  return {
    left: { kind: 'frac', n: '1', d: '2' },
    right: { kind: 'frac', n: '3', d: '8' },
    vL: 0.5,
    vR: 0.375,
  };
}

Page({
  data: {
    meta: META,
    points: 0,
    level: 0,
    phase: 'pick', // pick | play | over
    leftTokens: [],
    rightTokens: [],
    roundNo: 1,
    totalRounds: 10,
    avgLive: 0,
    wrongLive: 0,
    flash: '', // '' | good | bad
    grade: '',
    reward: 0,
    avgMs: 0,
    wrongCount: 0,
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
    if (this.flashTimer) clearTimeout(this.flashTimer);
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
      totalRounds: LEVELS[lv].rounds,
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
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.rounds = [];
    this.setData({
      points: getWallet().points,
      grade: '',
      flash: '',
      avgLive: 0,
      wrongLive: 0,
      phase: 'play',
    });
    this.nextRound();
  },

  nextRound() {
    const cfg = LEVELS[this.data.level];
    this.pair = genPair(cfg);
    this.goAt = Date.now();
    this.setData({
      leftTokens: exprToTokens(this.pair.left),
      rightTokens: exprToTokens(this.pair.right),
      roundNo: Math.min(this.rounds.length + 1, cfg.rounds),
      flash: '',
    });
  },

  tapSide(e) {
    if (this.data.phase !== 'play' || !this.pair || this.data.flash) return;
    const side = e.currentTarget.dataset.side;
    const ms = Date.now() - this.goAt;
    const biggerIsLeft = this.pair.vL > this.pair.vR;
    const correct = side === 'left' === biggerIsLeft;
    this.rounds.push({ ms: correct ? ms : WRONG_PENALTY_MS, wrong: !correct });
    const wrongCount = this.rounds.filter((r) => r.wrong).length;
    const avg = Math.round(this.rounds.reduce((s, r) => s + r.ms, 0) / this.rounds.length);
    this.setData({ flash: correct ? 'good' : 'bad', avgLive: avg, wrongLive: wrongCount });
    if (correct) wx.vibrateShort({ type: 'light' });
    this.flashTimer = setTimeout(() => {
      const cfg = LEVELS[this.data.level];
      if (this.rounds.length >= cfg.rounds) {
        this.finish();
      } else {
        this.nextRound();
      }
    }, 350);
  },

  finish() {
    const cfg = LEVELS[this.data.level];
    const avg = this.rounds.reduce((s, r) => s + r.ms, 0) / this.rounds.length;
    const g = gradeLowerIsBetter(avg, cfg.t);
    const prevUnlocked = getProgress(META.id).unlocked;
    recordGrade(META.id, this.data.level, g);
    const reward = GRADE_POINTS[g];
    submitScore(META.id, '我', reward);
    if (reward > 0) addPoints(reward);
    const prog = getProgress(META.id);
    this.setData({
      grade: g,
      reward,
      phase: 'over',
      avgMs: Math.round(avg),
      wrongCount: this.rounds.filter((r) => r.wrong).length,
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
