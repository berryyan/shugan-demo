const { GRADES } = require('../../core/logic.js');
const { getWallet } = require('../../core/wallet.js');

Page({
  data: {
    grades: [],
    points: 0,
  },
  onShow() {
    this.setData({ grades: GRADES, points: getWallet().points });
  },
  openSkill(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/intro/intro?skillId=${id}` });
  },
});
