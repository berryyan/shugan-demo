import { scoreAnswer } from './scoring.ts';

const modes = ['review', 'normal', 'advanced'] as const;
const ratios = [0, 0.25, 0.5, 0.75, 1];
const lines: string[] = [];

for (const mode of modes) {
  for (let streak = 0; streak <= 11; streak++) {
    for (const r of ratios) {
      for (let wa = 0; wa <= 3; wa++) {
        const res = scoreAnswer({
          mode, correct: true, timeLeftSec: r * 10, timeLimitSec: 10,
          streak, timedOut: false, wrongAttempts: wa,
        });
        lines.push(JSON.stringify({ mode, streak, r, wa, d: res.delta, ns: res.newStreak, b: res.breakdown }));
      }
    }
  }
  for (const timedOut of [true, false]) {
    const res = scoreAnswer({
      mode, correct: false, timeLeftSec: timedOut ? 0 : 3, timeLimitSec: 10,
      streak: 4, timedOut, wrongAttempts: 0,
    });
    lines.push(JSON.stringify({ mode, wrong: true, timedOut, d: res.delta, ns: res.newStreak, b: res.breakdown }));
  }
}
console.log(lines.join('\n'));
