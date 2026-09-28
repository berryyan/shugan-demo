const { findGame } = require('../../core/games.js');
const { getWallet, spendPoints, addPoints } = require('../../core/wallet.js');
const { GRADE_POINTS, getProgress, recordGrade, gradeLowerIsBetter } = require('../../core/levels.js');
const { submitScore } = require('../../core/leaderboard.js');

const META = findGame('memory-flash');

Page({
  data: {
    meta: META,
    points: 0,
    level: 0,
    phase: 'pick', // pick | show | input | over
    seq: [],
    seqText: '',
    input: [],
    inputText: '',
    grade: '',
    reward: 0,
    unlocked: 0,
    // 选关卡片渲染
    levelCards: [],
    feeOk: false,
    showSecs: '',
    newUnlock: false,
  },

  onLoad(options) {
    const lv = Math.min(Math.max(Number(options.level || 0) || 0, 0), 5);
    this.refresh(lv);
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  },

  refresh(level) {
    const prog = getProgress(META.id);
    const points = getWallet().points;
    this.setData({
      level: level !== undefined ? level : this.data.level,
      points,
      unlocked: prog.unlocked,
      feeOk: points >= META.entryFee,
      levelCards: META.levels.map((lv, i) => ({
        title: lv.title,
        hint: lv.hint,
        locked: i > prog.unlocked,
        grade: prog.grades[String(i)] || '',
        active: i === (level !== undefined ? level : this.data.level),
      })),
    });
  },

  pickLevel(e) {
    const i = e.currentTarget.dataset.i;
    const prog = getProgress(META.id);
    if (i > prog.unlocked) return;
    this.refresh(i);
  },

  startGame() {
    if (!spendPoints(META.entryFee)) return;
    const cfg = META.levels[this.data.level];
    const seq = Array.from({ length: cfg.len }, () => Math.floor(Math.random() * 10));
    this.setData({
      points: getWallet().points,
      seq,
      seqText: seq.join(' '),
      input: [],
      inputText: '',
      grade: '',
      phase: 'show',
      showSecs: (cfg.showMs / 1000).toFixed(1),
      showMs: cfg.showMs,
      animKey: Date.now(),
    });
    this.timer = setTimeout(() => {
      this.inputStart = Date.now();
      this.setData({ phase: 'input' });
    }, cfg.showMs);
  },

  tapDigit(e) {
    if (this.data.phase !== 'input') return;
    const d = e.currentTarget.dataset.d;
    const next = [...this.data.input, d];
    const idx = next.length - 1;
    if (next[idx] !== this.data.seq[idx]) {
      this.finish('F');
      return;
    }
    this.setData({ input: next, inputText: next.join('') });
    if (next.length === this.data.seq.length) {
      const inputMs = Date.now() - this.inputStart;
      this.finish(gradeLowerIsBetter(inputMs, META.levels[this.data.level].t));
    }
  },

  tapBack() {
    if (this.data.phase !== 'input') return;
    const next = this.data.input.slice(0, -1);
    this.setData({ input: next, inputText: next.join('') });
  },

  finish(g) {
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
