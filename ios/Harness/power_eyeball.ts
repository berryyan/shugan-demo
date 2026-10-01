import { GRADES, generateQuiz } from './ts/bank.ts';
import { exprKey } from './ts/types.ts';
const s = GRADES.flatMap(g=>g.units).flatMap(u=>u.skills).find(x=>x.id==='g6-power-flash')!;
let anomaly = 0;
for (let seed = 0; seed < 200 && anomaly < 6; seed++) {
  for (const q of generateQuiz(s, seed)) {
    const vals = q.choices.map(c => exprKey(c.value));
    const dup = vals.length !== new Set(vals).size;
    const correctCount = q.choices.filter(c=>c.correct).length;
    if (dup || correctCount !== 1) {
      anomaly++;
      console.log(`seed=${seed} ${exprKey(q.prompt)} 选项=[${vals}] dup=${dup} correct数=${correctCount}`);
    }
  }
}
console.log(anomaly === 0 ? '内容无异常（正确答案唯一、选项不重复）' : `发现 ${anomaly} 个异常`);
// 同时打印 12 道题看看长相
const qs = generateQuiz(s, 7);
for (const q of qs) console.log(exprKey(q.prompt), '→', exprKey(q.choices.find(c=>c.correct)!.value));
