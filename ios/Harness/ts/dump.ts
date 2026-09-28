/**
 * TS 端题目导出：21 个题库 × 种子 0~499 × 每局 10 题。
 * 输出 JSONL：每行一道题 [skillId, seed, qIndex, promptKey, requirement, [[choiceKey, correct, trap], ...]]
 * 与 Swift 端 dump 逐字节 diff，验证移植一致性。
 */
import { GRADES, generateQuiz } from './bank.ts';
import { exprKey } from './types.ts';

const skills: { id: string; questionCount: number; generators: any[] }[] = [];
for (const g of GRADES) for (const u of g.units) for (const s of u.skills) skills.push(s as any);

const lines: string[] = [];
for (const skill of skills) {
  for (let seed = 0; seed < 500; seed++) {
    const quiz = generateQuiz(skill as any, seed);
    quiz.forEach((q, i) => {
      lines.push(
        JSON.stringify([
          skill.id,
          seed,
          i,
          exprKey(q.prompt),
          q.requirement ?? '',
          q.choices.map((c) => [exprKey(c.value), c.correct, c.trap ?? null]),
        ]),
      );
    });
  }
}
console.log(lines.join('\n'));
