/**
 * 家长设置（小程序版）—— 家长密码（4 位 PIN）+ 愿望激励配置。
 * 持久化：wx.setStorageSync。与网页版 settings.ts 逻辑一致。
 *
 * 愿望激励：家长设置目标分（1000 为单位）+ 愿望文本；
 * 孩子积分余额达到目标后可兑换，兑换时从余额扣掉目标分，
 * 兑换后配置作废，设置页提醒家长兑现并设置新愿望。
 */

const KEY = 'shugan.settings.v1';

function load() {
  try {
    const s = wx.getStorageSync(KEY);
    if (s && typeof s === 'object') return s;
  } catch (e) { /* ignore */ }
  return { pin: null, wish: null, lastRedeemed: null };
}

function save(s) {
  wx.setStorageSync(KEY, s);
}

function getSettings() {
  return load();
}

/** 设置/修改家长密码 */
function setPin(pin) {
  const s = load();
  s.pin = pin;
  save(s);
}

/** 校验家长密码 */
function verifyPin(pin) {
  return load().pin === pin;
}

/** 保存愿望配置（null = 删除） */
function setWish(wish) {
  const s = load();
  s.wish = wish;
  save(s);
}

/** 孩子兑换愿望：记录到 lastRedeemed 并清空当前配置（积分扣减由调用方走钱包） */
function redeemWish() {
  const s = load();
  if (!s.wish) return null;
  const w = s.wish;
  s.lastRedeemed = { ...w, ts: Date.now() };
  s.wish = null;
  save(s);
  return w;
}

/** 家长已读"已兑换"提醒 */
function ackRedeemed() {
  const s = load();
  s.lastRedeemed = null;
  save(s);
}

module.exports = { getSettings, setPin, verifyPin, setWish, redeemWish, ackRedeemed };
