const { findGame } = require('../../core/games.js');
const { getWallet, spendPoints, addPoints } = require('../../core/wallet.js');
const { GRADE_POINTS, getProgress, recordGrade, gradeLowerIsBetter } = require('../../core/levels.js');
const { submitScore } = require('../../core/leaderboard.js');

const META = findGame('reaction-tap');
const ROUND_COUNT = 3;
const EARLY_PENALTY_MS = 1000; // 抢跑/点假信号：本轮按 1000ms 计

/** 关卡配置：等待区间 + 是否有假信号 + 评级线（平均反应 ms，越小越好） */
const LEVELS = [
  { wait: [1500, 3500], fake: false, t: [300, 350, 400, 450, 520, 600] },
  { wait: [1500, 3500], fake: false, t: [280, 330, 380, 430, 500, 560] },
  { wait: [800, 4000], fake: false, t: [280, 330, 380, 430, 500, 560] },
  { wait: [500, 4500], fake: false, t: [270, 320, 370, 420, 480, 550] },
  { wait: [1000, 4000], fake: true, t: [280, 330, 380, 430, 500, 560] },
  { wait: [800, 4500], fake: true, t: [260, 300, 340, 390, 450, 520] },
];

Page({
  data: {
    meta: META,
    points: 0,
    level: 0,
    phase: 'pick', // pick | wait | fake | go | roundDone | over
    round: 0, // 当前第几轮（0 起）
    rounds: [], // { ms, early }
    roundsText: '',
    lastText: '',
    grade: '',
    reward: 0,
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
    if (this.goTimer) clearTimeout(this.goTimer);
    if (this.fakeTimer) clearTimeout(this.fakeTimer);
    if (this.fakeOffTimer) clearTimeout(this.fakeOffTimer);
    if (this.nextTimer) clearTimeout(this.nextTimer);
    this.goTimer = this.fakeTimer = this.fakeOffTimer = this.nextTimer = null;
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
    this.setData({
      points: getWallet().points,
      rounds: [],
      roundsText: '',
      lastText: '',
      grade: '',
      round: 0,
    });
    this.startRound(0);
  },

  startRound(idx) {
    const cfg = LEVELS[this.data.level];
    const goDelay = cfg.wait[0] + Math.random() * (cfg.wait[1] - cfg.wait[0]);
    this.setData({ phase: 'wait', round: idx });
    // 假信号：等待超过 1.2 秒时，在中途闪一次黄光
    if (cfg.fake && goDelay > 1200) {
      const fakeAt = 400 + Math.random() * (goDelay - 800);
      this.fakeTimer = setTimeout(() => {
        this.setData({ phase: 'fake' });
        wx.vibrateShort({ type: 'light' });
        this.fakeOffTimer = setTimeout(() => {
          if (this.data.phase === 'fake') this.setData({ phase: 'wait' });
        }, 350);
      }, fakeAt);
    }
    this.goTimer = setTimeout(() => {
      this.goAt = Date.now();
      this.setData({ phase: 'go' });
      wx.vibrateShort({ type: 'light' });
    }, goDelay);
  },

  /** 全屏点击：wait/fake 阶段点击 = 抢跑 */
  tapStage() {
    const phase = this.data.phase;
    if (phase === 'wait' || phase === 'fake') {
      this.clearTimers();
      this.endRound({ ms: EARLY_PENALTY_MS, early: true });
      return;
    }
    if (phase === 'go') {
      const ms = Date.now() - this.goAt;
      this.endRound({ ms, early: false });
    }
  },

  endRound(r) {
    const rounds = [...this.data.rounds, r];
    this.setData({
      phase: 'roundDone',
      rounds,
      lastText: r.early ? '抢跑！按 1000ms 计' : `${Math.round(r.ms)}ms`,
    });
    this.nextTimer = setTimeout(() => {
      if (rounds.length >= ROUND_COUNT) {
        this.finish(rounds);
      } else {
        this.startRound(rounds.length);
      }
    }, 900);
  },

  finish(rounds) {
    const cfg = LEVELS[this.data.level];
    const avg = rounds.reduce((s, r) => s + r.ms, 0) / rounds.length;
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
      points: getWallet().points,
      unlocked: prog.unlocked,
      avgMs: Math.round(avg),
      roundsText: rounds.map((r) => (r.early ? '抢跑' : `${Math.round(r.ms)}ms`)).join(' · '),
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
