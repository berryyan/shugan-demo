import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { spendPoints, addPoints, useWallet } from '@/core/wallet';
import { submitScore } from '@/core/leaderboard';
import { MINI_GAMES } from '@/games/registry';
import {
  GRADE_POINTS,
  GRADE_STYLE,
  getProgress,
  gradeLowerIsBetter,
  recordGrade,
  type GradeLetter,
} from '@/games/levels';
import type { MathExpr } from '@/core/types';
import MathView from '@/components/MathView';
import { ArrowLeft, Lock } from 'lucide-react';

const META = MINI_GAMES.find((g) => g.id === 'bigger-tap')!;
const WRONG_PENALTY_MS = 2000; // 点错按 2 秒计入：乱猜平均成绩必炸

/** 关卡配置：题数 + 分母池 + 跨形态概率 + 差值区间 + 评级线（平均反应 ms，越小越好） */
const LEVELS: {
  rounds: number;
  denoms: number[];
  cross: number;
  minDiff: number;
  maxDiff: number;
  t: number[];
}[] = [
  { rounds: 10, denoms: [2, 4, 5, 8, 10], cross: 0.3, minDiff: 0.1, maxDiff: 0.5, t: [1300, 1600, 2000, 2500, 3100, 3800] },
  { rounds: 10, denoms: [2, 4, 5, 8, 10], cross: 0.5, minDiff: 0.08, maxDiff: 0.4, t: [1200, 1500, 1900, 2400, 3000, 3600] },
  { rounds: 12, denoms: [2, 3, 4, 5, 8, 10], cross: 0.5, minDiff: 0.06, maxDiff: 0.35, t: [1100, 1400, 1800, 2300, 2900, 3500] },
  { rounds: 12, denoms: [2, 3, 4, 5, 6, 8, 9, 10], cross: 0.4, minDiff: 0.05, maxDiff: 0.3, t: [1100, 1400, 1800, 2300, 2900, 3500] },
  { rounds: 15, denoms: [2, 3, 4, 5, 6, 8, 9, 10], cross: 0.5, minDiff: 0.04, maxDiff: 0.28, t: [1000, 1300, 1700, 2200, 2800, 3400] },
  { rounds: 15, denoms: [2, 3, 4, 5, 6, 7, 8, 9, 10], cross: 0.5, minDiff: 0.03, maxDiff: 0.25, t: [950, 1250, 1650, 2100, 2700, 3300] },
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const DECIMAL_OK = [2, 4, 5, 8, 10];

function coprimeNumerators(d: number): number[] {
  const list: number[] = [];
  for (let n = 1; n < d; n++) if (gcd(n, d) === 1) list.push(n);
  return list;
}

function decimalText(n: number, d: number): string {
  const scaled = n * (1000 / d);
  const s = String(scaled).padStart(4, '0');
  return `${s.slice(0, -3)}.${s.slice(-3)}`.replace(/0+$/, '').replace(/\.$/, '');
}

interface Pair {
  left: MathExpr;
  right: MathExpr;
  vL: number;
  vR: number;
}

/** 生成一对"接近但不同"的值：差值落在 [minDiff, maxDiff]，逼出数感而非硬算 */
function genPair(cfg: (typeof LEVELS)[number]): Pair {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  for (let tries = 0; tries < 100; tries++) {
    const d1 = pick(cfg.denoms);
    const d2 = pick(cfg.denoms);
    const n1 = pick(coprimeNumerators(d1));
    const n2 = pick(coprimeNumerators(d2));
    const v1 = n1 / d1;
    const v2 = n2 / d2;
    const diff = Math.abs(v1 - v2);
    if (diff < cfg.minDiff || diff > cfg.maxDiff) continue;
    // 右边可选小数形态（仅除得尽的分母）
    const right: MathExpr =
      Math.random() < cfg.cross && DECIMAL_OK.includes(d2)
        ? { kind: 'text', text: decimalText(n2, d2) }
        : { kind: 'frac', n: String(n2), d: String(d2) };
    return { left: { kind: 'frac', n: String(n1), d: String(d1) }, right, vL: v1, vR: v2 };
  }
  // 兜底：1/2 vs 3/8
  return {
    left: { kind: 'frac', n: '1', d: '2' },
    right: { kind: 'frac', n: '3', d: '8' },
    vL: 0.5,
    vR: 0.375,
  };
}

type Phase = 'pick' | 'play' | 'over';

/** 谁更大（关卡制）：数感 + 反应——改编 HGE2 第 21 关《我讨厌分数》 */
export default function BiggerTap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const [level, setLevel] = useState(() =>
    Math.min(Math.max(Number(searchParams.get('level') ?? 0), 0), 5),
  );
  const [phase, setPhase] = useState<Phase>('pick');
  const [pair, setPair] = useState<Pair | null>(null);
  const [rounds, setRounds] = useState<{ ms: number; wrong: boolean }[]>([]);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [grade, setGrade] = useState<GradeLetter | null>(null);
  const [progress, setProgress] = useState(() => getProgress(META.id));
  const goAtRef = useRef(0);
  const flashRef = useRef<number | null>(null);

  const cfg = LEVELS[level];

  useEffect(
    () => () => {
      if (flashRef.current) window.clearTimeout(flashRef.current);
    },
    [],
  );

  const nextRound = () => {
    setPair(genPair(cfg));
    setFlash(null);
    // 直接计时：后台标签页 rAF 不触发会导致计时起点丢失
    goAtRef.current = performance.now();
  };

  const startGame = () => {
    if (!spendPoints(META.entryFee)) return;
    setRounds([]);
    setGrade(null);
    setPhase('play');
    nextRound();
  };

  const tapSide = (side: 'left' | 'right') => {
    if (phase !== 'play' || !pair || flash) return;
    const ms = performance.now() - goAtRef.current;
    const biggerIsLeft = pair.vL > pair.vR;
    const correct = (side === 'left') === biggerIsLeft;
    const all = [...rounds, { ms: correct ? ms : WRONG_PENALTY_MS, wrong: !correct }];
    setRounds(all);
    setFlash(correct ? 'good' : 'bad');
    flashRef.current = window.setTimeout(() => {
      if (all.length >= cfg.rounds) {
        const avg = all.reduce((s, r) => s + r.ms, 0) / all.length;
        const g = gradeLowerIsBetter(avg, cfg.t);
        setGrade(g);
        recordGrade(META.id, level, g);
        setProgress(getProgress(META.id));
        submitScore(META.id, '我', GRADE_POINTS[g]);
        const reward = GRADE_POINTS[g];
        if (reward > 0) addPoints(reward);
        setPhase('over');
      } else {
        nextRound();
      }
    }, 350);
  };

  const avg = rounds.length ? Math.round(rounds.reduce((s, r) => s + r.ms, 0) / rounds.length) : 0;
  const wrongCount = rounds.filter((r) => r.wrong).length;
  const reward = grade ? GRADE_POINTS[grade] : 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-rose-600 to-orange-700 text-white flex flex-col">
      <header className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/games')} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">{META.icon} {META.title}</h1>
        <span className="ml-auto text-sm opacity-80">余额 {wallet.points}</span>
      </header>

      {phase === 'pick' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <p className="text-white/80 text-center max-w-xs">{META.description}</p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {META.levels.map((lv, i) => {
              const locked = i > progress.unlocked;
              const g = progress.grades[String(i)];
              return (
                <button
                  key={i}
                  disabled={locked}
                  onClick={() => setLevel(i)}
                  className={`relative rounded-2xl p-4 text-left transition-all ${
                    level === i ? 'bg-white text-rose-700' : 'bg-white/15 text-white'
                  } ${locked ? 'opacity-40' : 'active:scale-95'}`}
                >
                  <div className="font-black flex items-center gap-1.5">
                    {locked && <Lock className="w-4 h-4" />} {lv.title}
                  </div>
                  <div className={`text-xs mt-1 ${level === i ? 'text-rose-400' : 'text-white/60'}`}>
                    {lv.hint}
                  </div>
                  {g && (
                    <span className={`absolute top-2 right-2 w-7 h-7 rounded-full text-sm font-black flex items-center justify-center ${GRADE_STYLE[g]}`}>
                      {g}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={startGame}
            disabled={wallet.points < META.entryFee}
            className="h-16 px-10 rounded-2xl bg-white text-rose-700 font-black text-xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            {wallet.points >= META.entryFee ? `支付 ${META.entryFee} 积分 · 挑战${META.levels[level].title}` : '积分不足'}
          </button>
          <p className="text-xs text-white/50">点错按 2 秒计入 · 技巧：心里换成同一种形式再比</p>
        </main>
      )}

      {phase === 'play' && pair && (
        <main className="flex-1 flex flex-col px-4 gap-4">
          <div className="pt-2 flex justify-between text-sm font-bold">
            <span>
              第 {Math.min(rounds.length + 1, cfg.rounds)}/{cfg.rounds} 题
            </span>
            <span className="text-white/70">平均 {avg}ms{wrongCount > 0 && ` · 错 ${wrongCount}`}</span>
          </div>
          <p className="text-center text-white/80 text-lg font-bold">哪边更大？</p>
          <div className="flex-1 grid grid-cols-2 gap-3 content-center max-w-md mx-auto w-full">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                onPointerDown={() => tapSide(side)}
                className={`h-48 rounded-3xl text-6xl font-black flex items-center justify-center transition-all active:scale-95 ${
                  flash === 'good'
                    ? 'bg-emerald-400 text-emerald-900'
                    : flash === 'bad'
                      ? 'bg-red-400 text-red-900'
                      : 'bg-white text-slate-800'
                }`}
              >
                <MathView expr={side === 'left' ? pair.left : pair.right} />
              </button>
            ))}
          </div>
        </main>
      )}

      {phase === 'over' && grade && (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <span className={`w-28 h-28 rounded-full text-6xl font-black flex items-center justify-center ${GRADE_STYLE[grade]}`}>
            {grade}
          </span>
          <h2 className="text-2xl font-black">平均 {avg}ms · 错 {wrongCount} 题</h2>
          <p className="text-white/80">
            {grade === 'F'
              ? '没达到过关线，慢一点没关系，先比准再比快'
              : <>获得 <b className="text-amber-300">+{reward}</b> 积分{level === progress.unlocked - 1 && level < 5 && '，下一关已解锁！'}</>}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPhase('pick')} className="h-14 px-8 rounded-2xl bg-white text-rose-700 font-black">
              再来一次
            </button>
            <button onClick={() => navigate('/games')} className="h-14 px-8 rounded-2xl bg-white/15 font-bold">
              返回游戏厅
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
