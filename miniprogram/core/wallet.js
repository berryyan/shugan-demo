/**
 * 积分钱包（小程序版）—— 快问快答赚取积分。
 * 持久化：wx.setStorageSync。
 */

const KEY = 'shugan.wallet.v1';

function load() {
  try {
    const w = wx.getStorageSync(KEY);
    if (w && typeof w.points === 'number') return w;
  } catch (e) { /* ignore */ }
  return { points: 0, totalEarned: 0, totalSpent: 0 };
}

function save(w) {
  wx.setStorageSync(KEY, w);
}

function getWallet() {
  return load();
}

/** 加积分（负数先扣到 0 为止，积分不为负） */
function addPoints(delta) {
  const w = load();
  w.points = Math.max(0, w.points + delta);
  if (delta > 0) w.totalEarned += delta;
  if (delta < 0) w.totalSpent += -delta;
  save(w);
  return w;
}

/** 消费积分（入场费）：余额不足返回 false，成功扣减返回 true */
function spendPoints(cost) {
  const w = load();
  if (w.points < cost) return false;
  w.points -= cost;
  w.totalSpent += cost;
  save(w);
  return true;
}

/** 重置分数（家长手动调试）：积分余额清零 */
function resetWallet() {
  save({ points: 0, totalEarned: 0, totalSpent: 0 });
}

module.exports = { getWallet, addPoints, spendPoints, resetWallet };
