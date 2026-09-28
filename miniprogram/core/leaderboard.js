/**
 * 小游戏本地排行榜（小程序版，与网页版 leaderboard.ts 一致）—— 每个游戏独立榜单，保留前 10 名。
 */

const key = (gameId) => `shugan.lb.${gameId}.v2`;

function getLeaderboard(gameId) {
  try {
    const raw = wx.getStorageSync(key(gameId));
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return [];
}

/** 记录成绩（分数越大越好），返回名次（0 起），未上榜返回 -1 */
function submitScore(gameId, name, score) {
  const list = getLeaderboard(gameId);
  const entry = { name, score, date: new Date().toISOString().slice(0, 10) };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(entry);
  wx.setStorageSync(key(gameId), JSON.stringify(list.slice(0, 10)));
  return rank < 10 ? rank : -1;
}

module.exports = { getLeaderboard, submitScore };
