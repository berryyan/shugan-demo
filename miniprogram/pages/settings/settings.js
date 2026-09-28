const { getSettings, setPin, verifyPin, setWish, ackRedeemed } = require('../../core/settings.js');
const { getDayLog, daySummary, clearStudyLog } = require('../../core/studylog.js');
const { getWallet, resetWallet } = require('../../core/wallet.js');

const MODE_LABEL = { review: '📝 复习', normal: '🎯 闯关', advanced: '⚡ 进阶' };
const TARGETS = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000];

const pad = (n) => String(n).padStart(2, '0');

/** 设置页（家长）：4 位 PIN 门禁 → 当日学习记录 / 积分激励（愿望）/ 重置分数 */
Page({
  data: {
    unlocked: false,
    hasPin: false,

    // PIN 门禁
    pinInput: '',
    pinError: '',
    gateTitle: '',
    gateSub: '',
    gateBtn: '',

    // 已兑换提醒
    lastRedeemed: null,
    lastRedeemedDate: '',

    // 当日学习记录
    sum: { sessions: 0, totalQ: 0, correctQ: 0, accuracy: 0, earned: 0 },
    sumEarnedText: '+0',
    log: [],

    // 愿望
    wish: null,
    points: 0,
    wishPct: 0,
    targets: TARGETS.map((v) => v + ' 分'),
    targetIndex: 1, // 默认 2000
    wishMsg: '',

    // 修改密码
    changeStep: 'old', // old | new
    changeInput: '',
    pinMsg: '',

    // 重置分数
    resetArmed: false,
    resetDone: false,
  },

  onShow() {
    const s = getSettings();
    this.pinConfirm = null;
    this.newPin = null;
    this.setData({
      hasPin: !!s.pin,
      pinInput: '',
      pinError: '',
      changeStep: 'old',
      changeInput: '',
    });
    this.refreshGate();
    if (this.data.unlocked) this.refreshBody();
  },

  /* ---------------- 门禁 ---------------- */

  refreshGate() {
    const { hasPin } = this.data;
    this.setData({
      gateTitle: hasPin ? '输入家长密码' : this.pinConfirm !== null ? '再输一次确认' : '设置家长密码',
      gateSub: hasPin ? '4 位数字' : '4 位数字，防止孩子改设置',
      gateBtn: hasPin ? '解锁' : this.pinConfirm !== null ? '确认' : '下一步',
    });
  },

  onPinInput(e) {
    this.setData({ pinInput: e.detail.value.replace(/\D/g, '').slice(0, 4), pinError: '' });
  },

  submitPin() {
    const pin = this.data.pinInput;
    if (!/^\d{4}$/.test(pin)) {
      this.setData({ pinError: '请输入 4 位数字' });
      return;
    }
    if (!this.data.hasPin) {
      if (this.pinConfirm === null) {
        this.pinConfirm = pin;
        this.setData({ pinInput: '', pinError: '' });
        this.refreshGate();
        return;
      }
      if (this.pinConfirm !== pin) {
        this.pinConfirm = null;
        this.setData({ pinError: '两次输入不一致，请重新设置', pinInput: '' });
        this.refreshGate();
        return;
      }
      setPin(pin);
      this.setData({ unlocked: true, hasPin: true });
      this.refreshBody();
      return;
    }
    if (verifyPin(pin)) {
      this.setData({ unlocked: true });
      this.refreshBody();
    } else {
      this.setData({ pinError: '密码不对', pinInput: '' });
    }
  },

  /* ---------------- 内容 ---------------- */

  refreshBody() {
    const s = getSettings();
    const sum = daySummary();
    const log = getDayLog().map((e) => {
      const d = new Date(e.ts);
      return {
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        skillTitle: e.skillTitle,
        modeLabel: MODE_LABEL[e.mode] || e.mode,
        result: `${e.correct}/${e.total} 题`,
        earnedText: (e.earned >= 0 ? '+' : '') + e.earned,
        earnedNeg: e.earned < 0,
      };
    });
    const points = getWallet().points;
    this.setData({
      lastRedeemed: s.lastRedeemed,
      lastRedeemedDate: s.lastRedeemed
        ? `${s.lastRedeemed.ts ? new Date(s.lastRedeemed.ts).getMonth() + 1 : ''}月${s.lastRedeemed.ts ? new Date(s.lastRedeemed.ts).getDate() : ''}日`
        : '',
      sum,
      sumEarnedText: (sum.earned >= 0 ? '+' : '') + sum.earned,
      log,
      wish: s.wish,
      points,
      wishPct: s.wish ? Math.min(100, Math.round((points / s.wish.target) * 100)) : 0,
    });
  },

  ackRedeemed() {
    ackRedeemed();
    this.refreshBody();
  },

  /* ---------------- 愿望 ---------------- */

  pickTarget(e) {
    this.setData({ targetIndex: Number(e.detail.value) });
  },

  onWishInput(e) {
    this.wishText = e.detail.value;
  },

  saveWish() {
    const text = (this.wishText || '').trim();
    if (!text) {
      this.setData({ wishMsg: '请填写愿望内容' });
      return;
    }
    setWish({ target: TARGETS[this.data.targetIndex], text });
    this.wishText = '';
    this.setData({ wishMsg: '已保存 ✓' });
    this.refreshBody();
    setTimeout(() => this.setData({ wishMsg: '' }), 2000);
  },

  deleteWish() {
    setWish(null);
    this.refreshBody();
  },

  /* ---------------- 修改密码 ---------------- */

  onChangeInput(e) {
    this.setData({ changeInput: e.detail.value.replace(/\D/g, '').slice(0, 4) });
  },

  submitChangePin() {
    const input = this.data.changeInput;
    if (this.data.changeStep === 'old') {
      if (!verifyPin(input)) {
        this.flashPinMsg('原密码不对');
        this.setData({ changeInput: '' });
        return;
      }
      this.setData({ changeStep: 'new', changeInput: '' });
      return;
    }
    if (!/^\d{4}$/.test(input)) {
      this.flashPinMsg('新密码需要 4 位数字');
      return;
    }
    setPin(input);
    this.setData({ changeStep: 'old', changeInput: '' });
    this.flashPinMsg('密码已修改 ✓');
  },

  flashPinMsg(msg) {
    this.setData({ pinMsg: msg });
    setTimeout(() => this.setData({ pinMsg: '' }), 2000);
  },

  /* ---------------- 重置分数 ---------------- */

  armReset() {
    this.setData({ resetArmed: true });
  },

  cancelReset() {
    this.setData({ resetArmed: false });
  },

  confirmReset() {
    resetWallet();
    clearStudyLog();
    this.setData({ resetArmed: false, resetDone: true });
    this.refreshBody();
    setTimeout(() => this.setData({ resetDone: false }), 2500);
  },
});
