/**
 * TS 端题目导出：全部题库（含复习专属生成器，id 带 @review 后缀）× 种子 0~499 × 每局 10 题。
 * 输出 JSONL：每行一道题 [skillId, seed, qIndex, promptKey, requirement, [[choiceKey, correct, trap], ...]]
 * 与 Swift 端 dump 逐字节 diff，验证移植一致性。
 */
import { GRADES, generateQuiz } from './bank.ts';
import { exprKey } from './types.ts';

// 复习模式专属生成器以 id+"@review" 的虚拟技能参与导出，保证双端对复习题型也逐字节比对
const skills: { id: string; questionCount: number; generators: any[] }[] = [];
for (const g of GRADES)
  for (const u of g.units)
    for (const s of u.skills) {
      skills.push(s as any);
      const rg = (s as any).reviewGenerators;
      if (rg) skills.push({ ...(s as any), id: `${(s as any).id}@review`, generators: rg });
    }

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
