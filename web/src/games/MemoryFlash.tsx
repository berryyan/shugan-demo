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
import { ArrowLeft, Delete, Lock } from 'lucide-react';

const META = MINI_GAMES.find((g) => g.id === 'memory-flash')!;

/** 关卡配置：位数 + 展示时长 + 评级线（输入耗时 ms，越小越好） */
const LEVELS = [
  { len: 4, showMs: 1800, t: [2500, 3200, 4000, 5000, 6500, 8000] },
  { len: 5, showMs: 2100, t: [3000, 3800, 4700, 5800, 7500, 9500] },
  { len: 6, showMs: 2400, t: [3500, 4500, 5500, 7000, 9000, 11000] },
  { len: 6, showMs: 1800, t: [3500, 4500, 5500, 7000, 9000, 11000] },
  { len: 6, showMs: 1200, t: [3500, 4500, 5500, 7000, 9000, 11000] },
  { len: 6, showMs: 800, t: [3500, 4500, 5500, 7000, 9000, 11000] },
];

type Phase = 'pick' | 'show' | 'input' | 'over';

/** 数字闪现（关卡制）：连续专注力 + 工作记忆 */
export default function MemoryFlash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const [level, setLevel] = useState(() =>
    Math.min(Math.max(Number(searchParams.get('level') ?? 0), 0), 5),
  );
  const [phase, setPhase] = useState<Phase>('pick');
  const [seq, setSeq] = useState<number[]>([]);
  const [input, setInput] = useState<number[]>([]);
  const [grade, setGrade] = useState<GradeLetter | null>(null);
  const [progress, setProgress] = useState(() => getProgress(META.id));
  const timerRef = useRef<number | null>(null);
  const inputStartRef = useRef(0);

  const cfg = LEVELS[level];

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const startGame = () => {
    if (!spendPoints(META.entryFee)) return;
    const s = Array.from({ length: cfg.len }, () => Math.floor(Math.random() * 10));
    setSeq(s);
    setInput([]);
    setGrade(null);
    setPhase('show');
    timerRef.current = window.setTimeout(() => {
      inputStartRef.current = performance.now();
      setPhase('input');
    }, cfg.showMs);
  };

  const finish = (g: GradeLetter) => {
    setGrade(g);
    recordGrade(META.id, level, g);
    setProgress(getProgress(META.id));
    const reward = GRADE_POINTS[g];
    submitScore(META.id, '我', reward);
    if (reward > 0) addPoints(reward);
    setPhase('over');
  };

  const tapDigit = (d: number) => {
    if (phase !== 'input') return;
    const next = [...input, d];
    const idx = next.length - 1;
    if (next[idx] !== seq[idx]) {
      finish('F');
      return;
    }
    setInput(next);
    if (next.length === seq.length) {
      const inputMs = performance.now() - inputStartRef.current;
      finish(gradeLowerIsBetter(inputMs, cfg.t));
    }
  };

  const reward = grade ? GRADE_POINTS[grade] : 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-600 to-indigo-700 text-white flex flex-col">
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
                    level === i ? 'bg-white text-violet-700' : 'bg-white/15 text-white'
                  } ${locked ? 'opacity-40' : 'active:scale-95'}`}
                >
                  <div className="font-black flex items-center gap-1.5">
                    {locked && <Lock className="w-4 h-4" />} {lv.title}
                  </div>
                  <div className={`text-xs mt-1 ${level === i ? 'text-violet-400' : 'text-white/60'}`}>
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
            className="h-16 px-10 rounded-2xl bg-white text-violet-700 font-black text-xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            {wallet.points >= META.entryFee ? `支付 ${META.entryFee} 积分 · 挑战${META.levels[level].title}` : '积分不足'}
          </button>
          <p className="text-xs text-white/50">S=+30 A=+24 B=+18 C=+12 D=+8 E=+4 F=+0</p>
        </main>
      )}

      {phase === 'show' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <p className="text-white/70">记住这串数字（{seq.length} 位 · {(cfg.showMs / 1000).toFixed(1)} 秒）</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 max-w-sm">
            {seq.map((d, i) => (
              <span
                key={i}
                className={`font-black tabular-nums ${
                  seq.length <= 5 ? 'text-7xl' : seq.length <= 7 ? 'text-6xl' : 'text-5xl'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
          {/* 消失倒计时条：制造紧张感 */}
          <div className="w-56 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              key={seq.join('')}
              className="h-full bg-amber-300 memory-shrink"
              style={{ animationDuration: `${cfg.showMs}ms` }}
            />
          </div>
        </main>
      )}

      {phase === 'input' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <p className="text-white/70">按顺序输入（{input.length}/{seq.length}）· 越快评级越高</p>
          <div className="min-h-16 text-5xl font-black tracking-[0.2em] tabular-nums text-center break-all max-w-xs">
            {input.join('')}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <Pad key={d} onClick={() => tapDigit(d)}>{d}</Pad>
            ))}
            <Pad onClick={() => setInput((i) => i.slice(0, -1))}><Delete className="w-6 h-6 mx-auto" /></Pad>
            <Pad onClick={() => tapDigit(0)}>0</Pad>
            <div />
          </div>
        </main>
      )}

      {phase === 'over' && grade && (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <span className={`w-28 h-28 rounded-full text-6xl font-black flex items-center justify-center ${GRADE_STYLE[grade]}`}>
            {grade}
          </span>
          <h2 className="text-2xl font-black">
            {grade === 'F' ? '记忆断线了…' : `${META.levels[level].title}通过！`}
          </h2>
          <p className="text-white/80">
            {grade === 'F'
              ? '答错一位就是 F，再练一次吧'
              : <>获得 <b className="text-amber-300">+{reward}</b> 积分{level === progress.unlocked - 1 && level < 5 && '，下一关已解锁！'}</>}
          </p>
          <p className="text-white/50 text-sm">答案：{seq.join('')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('pick')}
              className="h-14 px-8 rounded-2xl bg-white text-violet-700 font-black"
            >
              再来一次
            </button>
            <button
              onClick={() => navigate('/games')}
              className="h-14 px-8 rounded-2xl bg-white/15 font-bold"
            >
              返回游戏厅
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

function Pad({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-16 rounded-2xl bg-white/15 text-2xl font-black active:bg-white/30 active:scale-95 transition-all"
    >
      {children}
    </button>
  );
}
