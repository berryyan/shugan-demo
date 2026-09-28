const { findTier, fmtMetric, stageLocked } = require('../../core/hge2.js');
const { getWallet, spendPoints, addPoints } = require('../../core/wallet.js');
const { GRADE_POINTS, GRADE_ORDER, getProgress, recordGrade, gradeHigherIsBetter, gradeLowerIsBetter } = require('../../core/levels.js');
const { submitScore } = require('../../core/leaderboard.js');
const SVG = require('../../core/hge2svg.js');

const GREEN = '#8BC34A';
const LANE_COLORS = ['#E53935', '#FDD835', '#1E88E5'];
const GRADE_COLOR = { S: '#FFD83D', A: '#B388FF', B: '#64B5F6', C: '#81C784', D: '#B0BEC5', E: '#CFD8DC', F: '#E57373' };

/* 石头剪刀布 */
const RPS_HANDS = ['r', 's', 'p'];
const RPS_ROUNDS = 20;
const randHand = () => RPS_HANDS[Math.floor(Math.random() * 3)];
function rpsWinner(l, r) {
  if (l === r) return 'draw';
  if ((l === 'r' && r === 's') || (l === 's' && r === 'p') || (l === 'p' && r === 'r')) return 'left';
  return 'right';
}
const speedPts = (ms) => (ms < 700 ? 6 : ms < 1000 ? 5 : ms < 1300 ? 4 : ms < 1700 ? 3 : ms < 2200 ? 2 : 1);

function vibrate() {
  try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* ignore */ }
}

Page({
  data: {
    tier: null,
    theme: null,
    points: 0,
    phase: 'pick', // pick | ready | countdown | play | over
    stageIdx: 0,
    stage: null,
    countdown: 3,
    grade: '',
    gradeColor: '',
    metricText: '',
    reward: 0,
    unlockedNextName: '',
    cards: [], // 选关星形卡
    ruler: [], // 评级标尺
    svg: { star: SVG.STAR, starDim: SVG.STAR_DIM, foot: SVG.FOOT, feather: SVG.FEATHER },
    lanes: LANE_COLORS,

    // tickle 机制
    tCount: '000',
    tLeft: '7.0',
    tLane: 0,
    tLaneKey: 0,
    tSquash: 0,
    tLaughs: [],

    // rps 机制
    rMs: '0000',
    rScore: 0,
    rRound: 1,
    rLHand: SVG.HANDS.r,
    rRHand: SVG.HANDS.r,
    rLAnim: '',
    rRAnim: '',
    rRoundKey: 0,
    rPop: null,
  },

  onLoad(options) {
    const tier = findTier(options.tierId);
    this.tier = tier;
    this.timers = [];
    this.setData({ tier, theme: tier.theme });
    wx.setNavigationBarTitle({ title: tier.title });
    this.refreshCards();
  },

  onUnload() {
    this.clearAll();
  },

  clearAll() {
    (this.timers || []).forEach((t) => clearTimeout(t));
    (this.intervals || []).forEach((t) => clearInterval(t));
    this.timers = [];
    this.intervals = [];
  },

  refreshCards() {
    const prog = getProgress(this.tier.id);
    const cards = this.tier.stages.map((s, i) => ({
      num: s.num,
      icon: s.icon,
      grade: prog.grades[String(i)] || '',
      gradeColor: prog.grades[String(i)] ? GRADE_COLOR[prog.grades[String(i)]] : '',
      locked: stageLocked(this.tier, prog.grades, i),
      lockText: s.disabled ? '暂未开放' : s.mechanic ? '未解锁' : '即将上线',
    }));
    this.setData({ cards, points: getWallet().points });
  },

  goHall() {
    wx.navigateBack();
  },

  /* ---------------- 选关 → 规则 → 倒计时 → 游玩 ---------------- */

  enterReady(e) {
    const i = e.currentTarget.dataset.i;
    if (this.data.cards[i].locked) return;
    const stage = this.tier.stages[i];
    const ruler = GRADE_ORDER.slice(0, 6).map((g, k) => ({ g, v: fmtMetric(stage, stage.t[k]).split(' ')[0] }));
    this.clearAll();
    this.setData({ stageIdx: i, stage, ruler, grade: '', phase: 'ready' });
  },

  payAndCountdown() {
    if (!spendPoints(this.tier.entryFee)) return;
    this.setData({ points: getWallet().points, phase: 'countdown', countdown: 3 });
    [2, 1, 0].forEach((v, k) => {
      this.timers.push(setTimeout(() => {
        if (v === 0) this.startPlay();
        else this.setData({ countdown: v });
      }, (k + 1) * 700));
    });
  },

  backToPick() {
    this.clearAll();
    this.refreshCards();
    this.setData({ phase: 'pick' });
  },

  startPlay() {
    this.setData({ phase: 'play' });
    const mech = this.data.stage.mechanic;
    if (mech === 'tickle') this.tickleStart();
    else if (mech === 'rps') this.rpsStart();
  },

  handleFinish(metric) {
    const stage = this.data.stage;
    const g = metric === null ? 'F' : stage.higherBetter ? gradeHigherIsBetter(metric, stage.t) : gradeLowerIsBetter(metric, stage.t);
    recordGrade(this.tier.id, this.data.stageIdx, g);
    const reward = GRADE_POINTS[g];
    submitScore(this.tier.id, '我', reward);
    if (reward > 0) addPoints(reward);
    const next = this.tier.stages[this.data.stageIdx + 1];
    const unlockedNext = g !== 'F' && next && !next.disabled && next.mechanic;
    this.clearAll();
    this.setData({
      phase: 'over',
      grade: g,
      gradeColor: GRADE_COLOR[g],
      metricText: metric === null ? '挑战失败' : fmtMetric(stage, metric),
      reward,
      unlockedNextName: unlockedNext ? next.name : '',
      points: getWallet().points,
    });
  },

  replay() {
    this.enterReady({ currentTarget: { dataset: { i: this.data.stageIdx } } });
  },

  /* ---------------- 第 1 关：不要挠我 ---------------- */

  tickleStart() {
    this.tTotal = 7000;
    this.tCountN = 0;
    this.tDone = false;
    this.tStartTs = Date.now();
    this.tLaneN = Math.floor(Math.random() * 3);
    this.setData({
      tCount: '000',
      tLeft: '7.0',
      tLane: this.tLaneN,
      tLaneKey: Date.now(),
      tSquash: 0,
      tLaughs: [],
    });
    const tick = setInterval(() => {
      const remain = Math.max(0, this.tTotal - (Date.now() - this.tStartTs));
      this.setData({ tLeft: (remain / 1000).toFixed(1) });
      if (remain <= 0 && !this.tDone) {
        this.tDone = true;
        this.handleFinish(this.tCountN);
      }
    }, 50);
    const move = setInterval(() => {
      let n = this.tLaneN;
      while (n === this.tLaneN) n = Math.floor(Math.random() * 3);
      this.tLaneN = n;
      this.setData({ tLane: n, tLaneKey: Date.now() });
    }, 700);
    this.intervals.push(tick, move);
  },

  tickleRestart() {
    if (this.tDone) return;
    this.tStartTs = Date.now();
    this.tCountN = 0;
    this.setData({ tCount: '000', tLeft: '7.0', tLaughs: [] });
  },

  ticklePress(e) {
    if (this.tDone) return;
    const i = e.currentTarget.dataset.i;
    if (i !== this.tLaneN) return; // 原版：点错不扣分，无反馈
    this.tCountN += 1;
    vibrate();
    const id = Date.now() + Math.random();
    const laughs = [...this.data.tLaughs.slice(-5), { id, x: 10 + Math.random() * 80 }];
    this.setData({
      tCount: String(this.tCountN).padStart(3, '0'),
      tSquash: this.tCountN,
      tLaughs: laughs,
    });
    const t = setTimeout(() => {
      this.setData({ tLaughs: this.data.tLaughs.filter((l) => l.id !== id) });
    }, 550);
    this.timers.push(t);
  },

  /* ---------------- 第 2 关：石头剪刀布 ---------------- */

  rpsStart() {
    this.rScoreN = 0;
    this.rRoundN = 1;
    this.rBusy = false;
    this.rHands = [randHand(), randHand()];
    this.rStartTs = Date.now();
    this.setData({
      rMs: '0000',
      rScore: 0,
      rRound: 1,
      rLHand: SVG.HANDS[this.rHands[0]],
      rRHand: SVG.HANDS[this.rHands[1]],
      rLAnim: '',
      rRAnim: '',
      rRoundKey: Date.now(),
      rPop: null,
    });
    const iv = setInterval(() => {
      this.setData({ rMs: String(Math.min(9999, Math.floor(Date.now() - this.rStartTs))).padStart(4, '0') });
    }, 50);
    this.intervals.push(iv);
  },

  rpsRestart() {
    this.clearAll();
    this.intervals = [];
    this.timers = [];
    this.rpsStart();
  },

  rpsAnswer(e) {
    if (this.rBusy) return;
    this.rBusy = true;
    const pick = e.currentTarget.dataset.pick;
    const elapsed = Date.now() - this.rStartTs;
    const actual = rpsWinner(this.rHands[0], this.rHands[1]);
    const ok = pick === actual;
    const delta = ok ? speedPts(elapsed) : -3;
    if (!ok) vibrate();
    this.rScoreN += delta;
    const leftAnim = actual === 'left' ? 'hge2winL .45s ease-out forwards' : actual === 'draw' ? 'hge2drawtie .45s ease-out' : 'hge2lose .45s ease-in forwards';
    const rightAnim = actual === 'right' ? 'hge2winR .45s ease-out forwards' : actual === 'draw' ? 'hge2drawtie .45s ease-out' : 'hge2lose .45s ease-in forwards';
    this.setData({
      rScore: this.rScoreN,
      rPop: { text: (delta > 0 ? '+' : '') + delta, ok },
      rLAnim: leftAnim,
      rRAnim: rightAnim,
    });
    const isLast = this.rRoundN >= RPS_ROUNDS;
    const t = setTimeout(() => {
      if (isLast) {
        this.handleFinish(this.rScoreN);
      } else {
        this.rRoundN += 1;
        this.rHands = [randHand(), randHand()];
        this.rStartTs = Date.now();
        this.rBusy = false;
        this.setData({
          rRound: this.rRoundN,
          rLHand: SVG.HANDS[this.rHands[0]],
          rRHand: SVG.HANDS[this.rHands[1]],
          rLAnim: '',
          rRAnim: '',
          rRoundKey: Date.now(),
          rPop: null,
        });
      }
    }, 480);
    this.timers.push(t);
  },
});
