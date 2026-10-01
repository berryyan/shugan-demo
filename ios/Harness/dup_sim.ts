import { GRADES, generateQuiz } from './ts/bank.ts';
import { exprKey } from './ts/types.ts';

const skill = GRADES.flatMap(g => g.units).flatMap(u => u.skills).find(s => s.id === 'g6-sense-simplify')!;
for (const count of [10, 20]) {
  let sessionsWithDup = 0, worstRepeat = 0, totalSessions = 5000;
  const freqCounter: Record<string, number> = {};
  for (let seed = 0; seed < totalSessions; seed++) {
    const qs = generateQuiz(skill, seed, count);
    const seen: Record<string, number> = {};
    for (const q of qs) {
      const k = exprKey(q.prompt);
      seen[k] = (seen[k] ?? 0) + 1;
      freqCounter[k] = (freqCounter[k] ?? 0) + 1;
    }
    const maxRep = Math.max(...Object.values(seen));
    if (maxRep > 1) sessionsWithDup++;
    worstRepeat = Math.max(worstRepeat, maxRep);
  }
  const uniq = Object.keys(freqCounter).length;
  console.log(`${count} 题/局: 有重复的局占 ${(sessionsWithDup/totalSessions*100).toFixed(1)}%，单题最多重复 ${worstRepeat} 次，题库实际不同题面数 = ${uniq}`);
}
