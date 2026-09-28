const { findSkill, generateQuiz, exprValue, modeParams } = require('../../core/logic.js');
const { scoreAnswer, SCORE_RULES } = require('../../core/scoring.js');
const { addPoints } = require('../../core/wallet.js');
const { exprToTokens } = require('../../core/tokens.js');
const { parseAnswerInput, formError, inputToTokens } = require('../../core/input.js');

/** 每题重答机制：首次作答 + 2 次重答 = 共 3 次机会；每次答错剩余时间 +5 秒；第 3 次答错直接判错过题 */
const RETRY_LIMIT = 2;
const RETRY_BONUS_SEC = 5;

Page({
  data: {
    skill: null,
    mode: 'normal',
    modeLabel: '',
    reviewMode: false,
    advanced: false,

    index: 0,
    total: 0,
    phase: 'answering',
    streak: 0,
    earned: 0,

    timeLeft: 10,
    timeLeftCeil: 10,
    timeLimitSec: 10,
    pct: 100,
    urgent: false,

    // 当前题
    requirement: '',
    promptTokens: [],
    promptScale: 1,
    choices: [], // [{id, correct, trap, tokens, cls}]
    pickedId: null,

    // 复习模式
    input: '',
    inputTokens: [],
    attempts: 0,
    keypadKeys: [],
    submitSpan: 3,
    submitWidth: '100%',

    // 反馈
    lastDelta: 0,
    lastBreakdown: [],
    lastFeedbackText: '',

    // 结算
    finalEarned: 0,
    correctCount: 0,
    firstTryCount: 0,
    avgTime: '0',
    failedIndex: 0,
    failedTrap: '',
    failedCorrectTokens: [],
    failedTimedOut: false,
  },

  onLoad(options) {
    const skill = findSkill(options.skillId);
    if (!skill) {
      wx.navigateBack();
      return;
    }
    const mode = options.mode === 'advanced' ? 'advanced' : options.mode === 'review' ? 'review' : 'normal';
    const { count, timeLimitSec } = modeParams(skill, mode);
    this.questions = generateQuiz(skill, Date.now(), count);
    this.records = [];
    this.startTs = 0;
    this.timer = null;
    this.advanceTimer = null;
    this.autoTimer = null;
    this.banked = false;

    // 键盘按键裁剪（与网页版一致：label + sub 副标小字）：numericKeypad 去掉分数线/带分数；hideMixedKey 去掉带分数空格
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((k) => ({ k, label: k }));
    keys.push({ k: '.', label: '.', sub: '小数点' });
    keys.push({ k: 'back', label: '⌫', icon: true });
    const extras = [];
    if (skill.allowNegative) extras.push({ k: '-', label: '−', sub: '负号' });
    if (!skill.numericKeypad) {
      if (!skill.hideMixedKey) extras.push({ k: ' ', label: '1 ␣ ½', sub: '带分数', small: true });
      extras.push({ k: '/', label: '3/4', sub: '分数线' });
    }
    const submitSpan = extras.length === 3 ? 3 : 3 - extras.length;
    // 3 列网格 gap 8px：WXML 不能做算术，提交键宽度提前算成 calc 表达式
    const submitWidth =
      submitSpan === 3 ? '100%' : submitSpan === 2 ? 'calc((100% - 16px) / 3 * 2 + 8px)' : 'calc((100% - 16px) / 3)';

    this.setData({
      skill,
      mode,
      reviewMode: mode === 'review',
      advanced: mode === 'advanced',
      modeLabel:
        (mode === 'review' ? '📝 复习' : mode === 'advanced' ? '⚡ 进阶' : '🎯 闯关') +
        (mode === 'advanced' ? ` ×${SCORE_RULES.advancedMultiplier} · 一错归零` : ''),
      total: count,
      timeLimitSec,
      keypadKeys: [...keys, ...extras],
      submitSpan,
      submitWidth,
    });
    wx.setNavigationBarTitle({ title: skill.title });
    this.loadQuestion(0);
  },

  onUnload() {
    this.clearTimers();
  },

  clearTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.timer = null;
    this.advanceTimer = null;
    this.autoTimer = null;
  },

  /* ---------------- 题目装载 ---------------- */

  loadQuestion(index) {
    const q = this.questions[index];
    if (!q) return;
    // 选项格子位置随机一次
    const slots = q.choices.map((_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const choices = q.choices.map((c, i) => ({
      id: c.id,
      correct: c.correct,
      trap: c.trap || '',
      tokens: exprToTokens(c.value),
      order: slots[i],
      cls: 'idle',
    }));
    this.setData({
      index,
      phase: 'answering',
      requirement: q.requirement || '',
      promptTokens: exprToTokens(q.prompt),
      promptScale: 1,
      choices,
      pickedId: null,
      input: '',
      inputTokens: [],
      attempts: 0,
      lastDelta: 0,
      lastBreakdown: [],
      lastFeedbackText: '',
      timeLeft: this.data.timeLimitSec,
      timeLeftCeil: this.data.timeLimitSec,
      pct: 100,
      urgent: false,
    });
    this.wrongIds = [];
    this.attempts = 0;
    this.fitPrompt();
    this.startTimer();
  },

  /** FitText 等价物：题面超宽时等比缩小（统一防溢出） */
  fitPrompt() {
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#promptOuter').boundingClientRect();
      query.select('#promptInner').boundingClientRect();
      query.exec((res) => {
        if (!res || !res[0] || !res[1]) return;
        const outer = res[0].width;
        const inner = res[1].width;
        if (inner > outer && inner > 0) {
          this.setData({ promptScale: Math.floor((outer / inner) * 100) / 100 });
        }
      });
    }, 80);
  },

  /* ---------------- 计时（+5 秒重答机制：startTs 后移实现补偿） ---------------- */

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.startTs = Date.now();
    this.timer = setInterval(() => {
      const elapsed = (Date.now() - this.startTs) / 1000;
      const left = this.data.timeLimitSec - elapsed;
      this.setData({
        timeLeft: Math.max(0, left),
        timeLeftCeil: Math.ceil(Math.max(0, left)),
        pct: Math.min(100, Math.max(0, (left / this.data.timeLimitSec) * 100)),
        urgent: left <= 3,
      });
      if (left <= 0) {
        if (this.data.advanced) this.failRun(null);
        else this.settle(null, this.attempts);
      }
    }, 100);
  },

  /* ---------------- 作答结算 ---------------- */

  settle(choiceId, attemptCount) {
    if (this.data.phase !== 'answering') return;
    if (this.timer) clearInterval(this.timer);
    const q = this.questions[this.data.index];
    const timedOut = choiceId === null;
    const elapsed = (Date.now() - this.startTs) / 1000;
    const choice = q.choices.find((c) => c.id === choiceId);
    const result = scoreAnswer({
      mode: this.data.mode,
      correct: !!(choice && choice.correct),
      timedOut,
      timeLeftSec: Math.max(0, this.data.timeLimitSec - elapsed),
      timeLimitSec: this.data.timeLimitSec,
      streak: this.data.streak,
      wrongAttempts: attemptCount,
    });
    this.records.push({
      correct: !!(choice && choice.correct),
      timedOut,
      timeUsedSec: elapsed,
      wrongAttempts: attemptCount,
    });
    // 选项状态着色
    const choices = this.data.choices.map((c) => {
      let cls = c.cls;
      if (c.correct) cls = 'correct';
      else if (c.id === choiceId || this.wrongIds.includes(c.id)) cls = 'wrong';
      else cls = 'dim';
      return { ...c, cls };
    });
    this.setData({
      phase: 'feedback',
      pickedId: choiceId,
      choices,
      streak: result.newStreak,
      earned: this.data.earned + result.delta,
      lastDelta: result.delta,
      lastBreakdown: result.breakdown,
      lastFeedbackText: result.breakdown.join(' · '),
    });
    this.advanceTimer = setTimeout(() => {
      if (this.data.index + 1 >= this.questions.length) this.finish();
      else this.loadQuestion(this.data.index + 1);
    }, 1400);
  },

  /** 闯关模式错选：扣分、+5 秒补偿、置灰、继续作答；第 3 次错直接判错过题 */
  pickWrong(choice) {
    const used = this.attempts + 1;
    if (used > RETRY_LIMIT) {
      this.settle(choice.id, used);
      return;
    }
    this.startTs += RETRY_BONUS_SEC * 1000;
    this.attempts = used;
    this.wrongIds.push(choice.id);
    const choices = this.data.choices.map((c) => (c.id === choice.id ? { ...c, cls: 'grey' } : c));
    this.setData({
      choices,
      streak: 0,
      attempts: used,
      earned: Math.max(0 - 1e9, this.data.earned + SCORE_RULES.wrongPickPenalty),
      lastDelta: SCORE_RULES.wrongPickPenalty,
      lastBreakdown: [
        `选错 ${SCORE_RULES.wrongPickPenalty} · +${RETRY_BONUS_SEC}s`,
        choice.trap || '再想一想',
        `还剩 ${RETRY_LIMIT - used + 1} 次机会`,
      ],
      lastFeedbackText: [
        `选错 ${SCORE_RULES.wrongPickPenalty} · +${RETRY_BONUS_SEC}s`,
        choice.trap || '再想一想',
        `还剩 ${RETRY_LIMIT - used + 1} 次机会`,
      ].join(' · '),
    });
  },

  onChoice(e) {
    if (this.data.phase !== 'answering') return;
    const id = e.currentTarget.dataset.id;
    if (this.wrongIds.includes(id)) return;
    const q = this.questions[this.data.index];
    const choice = q.choices.find((c) => c.id === id);
    if (!choice) return;
    if (this.data.advanced) {
      if (choice.correct) this.settle(id, this.attempts);
      else this.failRun(id);
      return;
    }
    if (choice.correct) this.settle(id, this.attempts);
    else this.pickWrong({ id, trap: choice.trap || '' });
  },

  /** 进阶模式：错选/超时 → 本局结束 */
  failRun(choiceId) {
    this.clearTimers();
    const q = this.questions[this.data.index];
    const picked = q.choices.find((c) => c.id === choiceId);
    const correct = q.choices.find((c) => c.correct);
    this.records.push({ correct: false, timedOut: choiceId === null, timeUsedSec: this.data.timeLimitSec, wrongAttempts: this.attempts });
    this.setData({
      phase: 'failed',
      failedIndex: this.data.index + 1,
      failedTrap: (picked && picked.trap) || '',
      failedCorrectTokens: exprToTokens(correct.value),
      failedTimedOut: choiceId === null,
    });
    this.bankScore(0);
  },

  /* ---------------- 复习模式：键盘 + 填空 ---------------- */

  pressKey(e) {
    if (this.data.phase !== 'answering') return;
    const k = e.currentTarget.dataset.key;
    let s = this.data.input;
    if (k === 'back') s = s.slice(0, -1);
    else if (k === 'clear') s = '';
    else if (/^\d$/.test(k)) {
      if (s.length < 9) s = s + k;
    } else if (k === '-') {
      if (s === '') s = '-';
    } else if (k === '.') {
      if (s && s !== '-' && !/[./ ]/.test(s)) s = s + '.';
    } else if (k === '/') {
      if (s && s !== '-' && !s.includes('/') && !s.includes('.') && !/ $/.test(s)) s = s + '/';
    } else if (k === ' ') {
      if (s && s !== '-' && !/[./ ]/.test(s)) s = s + ' ';
    }
    this.setData({ input: s, inputTokens: inputToTokens(s) });
    this.checkAutoSubmit(s);
  },

  /** 答对自动提交：结构完整（含 / . 或空格）+ 数值正确 + 形式合规 + 600ms 无新按键 */
  checkAutoSubmit(input) {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    if (this.data.mode !== 'review' || this.data.phase !== 'answering') return;
    if (!input || !/[/. ]/.test(input)) return;
    const parsed = parseAnswerInput(input);
    if (!parsed) return;
    const q = this.questions[this.data.index];
    const correct = q.choices.find((c) => c.correct);
    if (Math.abs(parsed.value - exprValue(correct.value)) > 1e-9) return;
    const skill = this.data.skill;
    if (formError(parsed, correct.value, skill.acceptImproper, skill.allowUnreduced)) return;
    this.autoTimer = setTimeout(() => {
      if (this.data.input === input && this.data.phase === 'answering') this.submitInput();
    }, 600);
  },

  /** 填错统一处理：扣分 + 剩余时间 +5 秒 + 清空重输；第 3 次错直接判错过题 */
  wrongSubmit(msg) {
    const used = this.attempts + 1;
    if (used > RETRY_LIMIT) {
      const q = this.questions[this.data.index];
      const wrongChoice = q.choices.find((c) => !c.correct);
      this.settle(wrongChoice.id, used);
      return;
    }
    this.startTs += RETRY_BONUS_SEC * 1000;
    this.attempts = used;
    const breakdown = [msg, `填错 ${SCORE_RULES.reviewWrongPenalty} · +${RETRY_BONUS_SEC}s`, `还剩 ${RETRY_LIMIT - used + 1} 次机会`];
    this.setData({
      streak: 0,
      attempts: used,
      earned: this.data.earned + SCORE_RULES.reviewWrongPenalty,
      lastDelta: SCORE_RULES.reviewWrongPenalty,
      lastBreakdown: breakdown,
      lastFeedbackText: breakdown.join(' · '),
      input: '',
      inputTokens: [],
    });
  },

  submitInput() {
    if (this.data.phase !== 'answering') return;
    const parsed = parseAnswerInput(this.data.input);
    if (!parsed) {
      const msg = '格式不对：整数、小数、3/4 或 1 1/2（带分数用空格隔开）';
      this.setData({ lastDelta: 0, lastBreakdown: [msg], lastFeedbackText: msg });
      return;
    }
    const q = this.questions[this.data.index];
    const correct = q.choices.find((c) => c.correct);
    const correctVal = exprValue(correct.value);
    if (Math.abs(parsed.value - correctVal) < 1e-9) {
      const skill = this.data.skill;
      const ferr = formError(parsed, correct.value, skill.acceptImproper, skill.allowUnreduced);
      if (ferr) {
        this.wrongSubmit(ferr);
        return;
      }
      this.settle(correct.id, this.attempts);
    } else {
      this.wrongSubmit('不对，再算一遍');
    }
  },

  /* ---------------- 结束 ---------------- */

  finish() {
    this.clearTimers();
    const records = this.records;
    const correctCount = records.filter((r) => r.correct).length;
    const firstTryCount = records.filter((r) => r.correct && r.wrongAttempts === 0).length;
    const avgTime = records.length
      ? (records.reduce((s, r) => s + r.timeUsedSec, 0) / records.length).toFixed(1)
      : '0';
    const finalEarned = this.data.advanced ? this.data.earned * SCORE_RULES.advancedMultiplier : this.data.earned;
    this.setData({ phase: 'done', correctCount, firstTryCount, avgTime, finalEarned });
    this.bankScore(finalEarned);
  },

  bankScore(score) {
    if (this.banked) return;
    this.banked = true;
    if (score !== 0) addPoints(score);
    const { logSession } = require('../../core/studylog.js');
    logSession({
      skillId: this.data.skill.id,
      skillTitle: this.data.skill.title,
      mode: this.data.mode,
      correct: this.records.filter((r) => r.correct).length,
      total: this.records.length,
      earned: score,
      durationSec: this.records.reduce((s, r) => s + r.timeUsedSec, 0),
    });
  },

  restart() {
    wx.redirectTo({
      url: `/pages/quiz/quiz?skillId=${this.data.skill.id}${this.data.mode === 'normal' ? '' : '&mode=' + this.data.mode}`,
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' });
  },

  goNormal() {
    wx.redirectTo({ url: `/pages/quiz/quiz?skillId=${this.data.skill.id}` });
  },

  goBack() {
    wx.navigateBack();
  },
});
