/**
 * 学习日志 —— 每局快问快答结束时记录一条，供设置页"当日学习记录"给家长查看。
 * 本地持久化（localStorage），只保留最近 7 天，手动"重置分数"时清空。
 */

export interface StudyEntry {
  ts: number; // 毫秒时间戳
  skillId: string;
  skillTitle: string;
  mode: 'review' | 'normal' | 'advanced';
  correct: number; // 答对题数
  total: number; // 总题数
  earned: number; // 本局积分（可能为负）
  durationSec: number; // 总用时
}

const KEY = 'shugan.studylog.v1';
const KEEP_DAYS = 7;

function load(): StudyEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StudyEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

function save(list: StudyEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('shugan-studylog-change'));
}

/** 记录一局 */
export function logSession(e: Omit<StudyEntry, 'ts'>) {
  const list = load();
  list.push({ ...e, ts: Date.now() });
  // 只保留最近 7 天
  const cutoff = Date.now() - KEEP_DAYS * 86400_000;
  save(list.filter((x) => x.ts >= cutoff));
}

/** 清空（手动重置分数时调用） */
export function clearStudyLog() {
  save([]);
}

function sameDay(ts: number, day: Date): boolean {
  const d = new Date(ts);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/** 取某一天的记录（默认今天），按时间倒序 */
export function getDayLog(day = new Date()): StudyEntry[] {
  return load()
    .filter((e) => sameDay(e.ts, day))
    .sort((a, b) => b.ts - a.ts);
}

/** 某日汇总统计 */
export function daySummary(day = new Date()) {
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
