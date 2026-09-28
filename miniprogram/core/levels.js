/**
 * 小游戏关卡框架（小程序版，与网页版 levels.ts 一致）—— 参照 Hardest Game Ever 2：
 * 每个游戏 6 关，每关按成绩评 S/A/B/C/D/E/F 七级，达到 E 解锁下一关。
 * 进度本地持久化 wx.setStorageSync。
 */

const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

/** 各评级对应的积分返还（入场费之外的净收益由入场费调节） */
const GRADE_POINTS = { S: 30, A: 24, B: 18, C: 12, D: 8, E: 4, F: 0 };

const KEY = 'shugan.gameProgress.v1';

function loadAll() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {};
}

function getProgress(gameId) {
  return loadAll()[gameId] || { unlocked: 0, grades: {} };
}

/** 记录一关成绩；非 F 解锁下一关。返回是否刷新该关最佳。 */
function recordGrade(gameId, level, grade) {
  const all = loadAll();
  const p = all[gameId] || { unlocked: 0, grades: {} };
  const prev = p.grades[String(level)];
  const better = !prev || GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(prev);
  if (better) p.grades[String(level)] = grade;
  if (grade !== 'F' && level === p.unlocked) p.unlocked = Math.min(p.unlocked + 1, 5);
  all[gameId] = p;
  wx.setStorageSync(KEY, JSON.stringify(all));
  return better;
}

/** 评级：指标越小越好（耗时类）。thresholds = [S, A, B, C, D, E] 各自上限 */
function gradeLowerIsBetter(metric, t) {
  if (metric <= t[0]) return 'S';
  if (metric <= t[1]) return 'A';
  if (metric <= t[2]) return 'B';
  if (metric <= t[3]) return 'C';
  if (metric <= t[4]) return 'D';
  if (metric <= t[5]) return 'E';
  return 'F';
}

/** 评级：指标越大越好（得分类）。thresholds = [S, A, B, C, D, E] 各自下限 */
function gradeHigherIsBetter(metric, t) {
  if (metric >= t[0]) return 'S';
  if (metric >= t[1]) return 'A';
  if (metric >= t[2]) return 'B';
  if (metric >= t[3]) return 'C';
  if (metric >= t[4]) return 'D';
  if (metric >= t[5]) return 'E';
  return 'F';
}

module.exports = { GRADE_ORDER, GRADE_POINTS, getProgress, recordGrade, gradeLowerIsBetter, gradeHigherIsBetter };
