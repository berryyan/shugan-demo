/**
 * 小游戏关卡框架 —— 参照 Hardest Game Ever 2：
 * 每个游戏 6 关，每关按成绩评 S/A/B/C/D/E/F 七级，达到 E 解锁下一关。
 * 进度本地持久化，换服务端时仅需替换 load/save。
 */

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const GRADE_ORDER: GradeLetter[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

/** 各评级对应的积分返还（入场费之外的净收益由入场费调节） */
export const GRADE_POINTS: Record<GradeLetter, number> = {
  S: 30,
  A: 24,
  B: 18,
  C: 12,
  D: 8,
  E: 4,
  F: 0,
};

export interface GameProgress {
  /** 已解锁到的关卡（0 起，含） */
  unlocked: number;
  /** 每关最佳评级 */
  grades: Record<string, GradeLetter>;
}

const KEY = 'shugan.gameProgress.v1';

function loadAll(): Record<string, GameProgress> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

export function getProgress(gameId: string): GameProgress {
  return loadAll()[gameId] ?? { unlocked: 0, grades: {} };
}

/** 记录一关成绩；非 F 解锁下一关。返回是否刷新该关最佳。 */
export function recordGrade(gameId: string, level: number, grade: GradeLetter): boolean {
  const all = loadAll();
  const p = all[gameId] ?? { unlocked: 0, grades: {} };
  const prev = p.grades[String(level)];
  const better = !prev || GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(prev);
  if (better) p.grades[String(level)] = grade;
  if (grade !== 'F' && level === p.unlocked) p.unlocked = Math.min(p.unlocked + 1, 5);
  all[gameId] = p;
  localStorage.setItem(KEY, JSON.stringify(all));
  return better;
}

/** 评级：指标越小越好（耗时类）。thresholds = [S, A, B, C, D, E] 各自上限 */
export function gradeLowerIsBetter(metric: number, t: number[]): GradeLetter {
  if (metric <= t[0]) return 'S';
  if (metric <= t[1]) return 'A';
  if (metric <= t[2]) return 'B';
  if (metric <= t[3]) return 'C';
  if (metric <= t[4]) return 'D';
  if (metric <= t[5]) return 'E';
  return 'F';
}

/** 评级：指标越大越好（得分类）。thresholds = [S, A, B, C, D, E] 各自下限 */
export function gradeHigherIsBetter(metric: number, t: number[]): GradeLetter {
  if (metric >= t[0]) return 'S';
  if (metric >= t[1]) return 'A';
  if (metric >= t[2]) return 'B';
  if (metric >= t[3]) return 'C';
  if (metric >= t[4]) return 'D';
  if (metric >= t[5]) return 'E';
  return 'F';
}

/** 评级徽章配色 */
export const GRADE_STYLE: Record<GradeLetter, string> = {
  S: 'bg-amber-400 text-amber-900',
  A: 'bg-violet-400 text-white',
  B: 'bg-sky-400 text-white',
  C: 'bg-emerald-400 text-white',
  D: 'bg-slate-300 text-slate-600',
  E: 'bg-slate-200 text-slate-500',
  F: 'bg-red-200 text-red-500',
};
