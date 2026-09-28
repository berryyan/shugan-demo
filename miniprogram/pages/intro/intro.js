const { findSkill, modeParams } = require('../../core/logic.js');
const { getWallet } = require('../../core/wallet.js');

Page({
  data: {
    skill: null,
    points: 0,
    reviewParams: null,
    normalParams: null,
    advancedParams: null,
  },
  onLoad(options) {
    const skill = findSkill(options.skillId);
    if (!skill) {
      wx.navigateBack();
      return;
    }
    this.setData({
      skill,
      points: getWallet().points,
      reviewParams: modeParams(skill, 'review'),
      normalParams: modeParams(skill, 'normal'),
      advancedParams: modeParams(skill, 'advanced'),
    });
    wx.setNavigationBarTitle({ title: skill.title });
  },
  start(e) {
    const mode = e.currentTarget.dataset.mode;
    const q = `skillId=${this.data.skill.id}` + (mode === 'normal' ? '' : `&mode=${mode}`);
    wx.redirectTo({ url: `/pages/quiz/quiz?${q}` });
  },
  goBack() {
    wx.navigateBack();
  },
});
