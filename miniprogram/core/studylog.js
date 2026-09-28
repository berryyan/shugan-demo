/**
 * 学习日志（小程序版）—— 每局快问快答结束时记录一条，供设置页"当日学习记录"给家长查看。
 * 持久化：wx.setStorageSync，只保留最近 7 天，手动"重置分数"时清空。
 * 与网页版 studyLog.ts 逻辑一致。
 */

const KEY = 'shugan.studylog.v1';
const KEEP_DAYS = 7;

function load() {
  try {
    const list = wx.getStorageSync(KEY);
    if (Array.isArray(list)) return list;
  } catch (e) { /* ignore */ }
  return [];
}

function save(list) {
  wx.setStorageSync(KEY, list);
}

/** 记录一局：{ skillId, skillTitle, mode, correct, total, earned, durationSec } */
function logSession(e) {
  const list = load();
  list.push({ ...e, ts: Date.now() });
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  save(list.filter((x) => x.ts >= cutoff));
}

/** 清空（手动重置分数时调用） */
function clearStudyLog() {
  save([]);
}

function sameDay(ts, day) {
  const d = new Date(ts);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/** 取某一天的记录（默认今天），按时间倒序 */
function getDayLog(day = new Date()) {
  return load()
    .filter((e) => sameDay(e.ts, day))
    .sort((a, b) => b.ts - a.ts);
}

/** 某日汇总统计 */
function daySummary(day = new Date()) {
  const log = getDayLog(day);
  const totalQ = log.reduce((s, e) => s + e.total, 0);
  const correctQ = log.reduce((s, e) => s + e.correct, 0);
  return {
    sessions: log.length,
    totalQ,
    correctQ,
    accuracy: totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0,
    earned: log.reduce((s, e) => s + e.earned, 0),
    durationSec: Math.round(log.reduce((s, e) => s + e.durationSec, 0)),
  };
}

module.exports = { logSession, clearStudyLog, getDayLog, daySummary };
