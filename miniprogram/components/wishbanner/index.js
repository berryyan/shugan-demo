const { getWallet, addPoints } = require('../../core/wallet.js');
const { getSettings, redeemWish } = require('../../core/settings.js');

/**
 * 愿望激励条（孩子侧）：家长设置了愿望后显示在学习页/游戏厅顶部。
 * 未达标：进度条"还差 N 分"；达标：金色可点，点击弹窗确认兑换（扣除目标分，愿望作废）。
 */
Component({
  data: {
    wish: null,
    points: 0,
    reached: false,
    pct: 0,
    lack: 0,
    confirming: false,
    justRedeemed: '',
  },

  pageLifetimes: {
    show() {
      this.refresh();
    },
  },

  lifetimes: {
    attached() {
      this.refresh();
    },
  },

  methods: {
    refresh() {
      const wish = getSettings().wish;
      const points = getWallet().points;
      this.setData({
        wish,
        points,
        reached: !!wish && points >= wish.target,
        pct: wish ? Math.min(100, Math.round((points / wish.target) * 100)) : 0,
        lack: wish ? Math.max(0, wish.target - points) : 0,
      });
    },

    tapBanner() {
      if (this.data.reached) this.setData({ confirming: true });
    },

    cancelRedeem() {
      this.setData({ confirming: false });
    },

    noop() {},

    confirmRedeem() {
      const wish = this.data.wish;
      if (!wish) return;
      addPoints(-wish.target);
      const w = redeemWish();
      this.setData({ confirming: false, wish: null });
      if (w) this.setData({ justRedeemed: w.text });
    },

    dismissRedeemed() {
      this.setData({ justRedeemed: '' });
    },
  },
});
