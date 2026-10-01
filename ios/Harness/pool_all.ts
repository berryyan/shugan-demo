import { GRADES, generateQuiz } from './ts/bank.ts';
import { exprKey } from './ts/types.ts';
for (const g of GRADES) for (const u of g.units) for (const s of u.skills) {
  const freq: Record<string, number> = {};
  for (let seed = 0; seed < 500; seed++) for (const q of generateQuiz(s, seed)) freq[exprKey(q.prompt)] = 1;
  console.log(`${s.id}  ${s.title}  不同题面=${Object.keys(freq).length}  (10题/局)`);
}
