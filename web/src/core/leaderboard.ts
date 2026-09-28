/**
 * 小游戏本地排行榜 —— 每个游戏独立榜单，保留前 10 名。
 * 后续接服务端时仅需替换 load/save 实现。
 */

export interface RankEntry {
  name: string;
  score: number;
  date: string;
}

const key = (gameId: string) => `shugan.lb.${gameId}.v2`; // v2：关卡制等级分，与旧版连续模式分数不兼容

export function getLeaderboard(gameId: string): RankEntry[] {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (raw) return JSON.parse(raw) as RankEntry[];
  } catch {
    /* ignore */
  }
  return [];
}

/** 记录成绩（分数越大越好），返回名次（0 起），未上榜返回 -1 */
export function submitScore(gameId: string, name: string, score: number): number {
  const list = getLeaderboard(gameId);
  const entry: RankEntry = { name, score, date: new Date().toISOString().slice(0, 10) };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const rank = list.indexOf(entry);
  const top = list.slice(0, 10);
  localStorage.setItem(key(gameId), JSON.stringify(top));
  return rank < 10 ? rank : -1;
}

export function getBest(gameId: string): RankEntry | null {
  return getLeaderboard(gameId)[0] ?? null;
}
