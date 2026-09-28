const { MINI_GAMES, stageLocked, tierLockedReason } = require('../../core/games.js');
const { getWallet } = require('../../core/wallet.js');
const { getProgress } = require('../../core/levels.js');
const { getLeaderboard } = require('../../core/leaderboard.js');

Page({
  data: {
    points: 0,
    games: [], // 渲染用：注册表 + 每关评级/锁定 + 排行榜前 5
  },

  onShow() {
    const points = getWallet().points;
    const games = MINI_GAMES.map((g) => {
      const prog = getProgress(g.id);
      const lockReason = g._tier ? tierLockedReason(g._tierIndex) : null;
      const dots = g.levels.map((lv, i) => {
        const grade = prog.grades[String(i)];
        const locked = g._tier ? stageLocked(g._tier, prog.grades, i) : i > prog.unlocked;
        return {
          label: grade || (locked ? '·' : String(i + 1)),
          cls: grade ? 'grade-' + grade : locked ? 'dot-locked' : 'dot-open',
        };
      });
      return {
        ...g,
        lockReason,
        affordable: points >= g.entryFee,
        dots,
        sCount: Object.values(prog.grades).filter((x) => x === 'S').length,
        board: getLeaderboard(g.id).slice(0, 5),
      };
    });
    this.setData({ points, games });
  },

  openGame(e) {
    const g = e.currentTarget.dataset.game;
    if (g.lockReason) return;
    wx.navigateTo({ url: g.page });
  },
});
