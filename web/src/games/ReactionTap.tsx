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
import { ArrowLeft, Lock } from 'lucide-react';

const META = MINI_GAMES.find((g) => g.id === 'reaction-tap')!;
const ROUNDS = 3;
const EARLY_PENALTY_MS = 1000; // 抢跑/点假信号罚时：防止无脑连点
const FAKE_FLASH_MS = 350;

/** 关卡配置：等待区间(ms) + 是否有假信号 + 评级线（平均反应 ms，越小越好） */
const LEVELS = [
  { wait: [1500, 3500], fake: false, t: [300, 350, 400, 450, 520, 600] },
  { wait: [1500, 3500], fake: false, t: [280, 330, 380, 430, 500, 560] },
  { wait: [800, 4000], fake: false, t: [280, 330, 380, 430, 500, 560] },
  { wait: [500, 4500], fake: false, t: [270, 320, 370, 420, 480, 550] },
  { wait: [1000, 4000], fake: true, t: [280, 330, 380, 430, 500, 560] },
  { wait: [800, 4500], fake: true, t: [260, 300, 340, 390, 450, 520] },
];

type Phase = 'pick' | 'wait' | 'fake' | 'go' | 'roundDone' | 'over';

interface RoundResult {
  ms: number;
  early: boolean;
}

/** 极速点击（关卡制）：反应力 + 持续专注（抢跑和点假信号都会被罚） */
export default function ReactionTap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const [level, setLevel] = useState(() =>
    Math.min(Math.max(Number(searchParams.get('level') ?? 0), 0), 5),
  );
  const [phase, setPhase] = useState<Phase>('pick');
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [grade, setGrade] = useState<GradeLetter | null>(null);
  const [progress, setProgress] = useState(() => getProgress(META.id));
  const goAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const fakeTimerRef = useRef<number | null>(null);

  const cfg = LEVELS[level];

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (fakeTimerRef.current) window.clearTimeout(fakeTimerRef.current);
    },
    [],
  );

  const startGame = () => {
    if (!spendPoints(META.entryFee)) return;
    setRounds([]);
    setGrade(null);
    armRound();
  };

  const armRound = () => {
    setPhase('wait');
    const goDelay = cfg.wait[0] + Math.random() * (cfg.wait[1] - cfg.wait[0]);
    timerRef.current = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase('go');
    }, goDelay);
    // 假信号：在绿灯前随机闪一次黄光，点了算抢跑
    if (cfg.fake && goDelay > 1200) {
      const fakeAt = 400 + Math.random() * (goDelay - 800);
      fakeTimerRef.current = window.setTimeout(() => {
        setPhase('fake');
        fakeTimerRef.current = window.setTimeout(() => setPhase((p) => (p === 'fake' ? 'wait' : p)), FAKE_FLASH_MS);
      }, fakeAt);
    }
  };

  const tap = () => {
    if (phase === 'wait' || phase === 'fake') {
      // 抢跑/点了假信号：罚时并计入本轮
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (fakeTimerRef.current) window.clearTimeout(fakeTimerRef.current);
      endRound([...rounds, { ms: EARLY_PENALTY_MS, early: true }]);
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - goAtRef.current);
      endRound([...rounds, { ms, early: false }]);
    }
  };

  const endRound = (all: RoundResult[]) => {
    setRounds(all);
    if (all.length >= ROUNDS) {
      const avg = all.reduce((s, t) => s + t.ms, 0) / all.length;
      const g = gradeLowerIsBetter(avg, cfg.t);
      setGrade(g);
      recordGrade(META.id, level, g);
      setProgress(getProgress(META.id));
      const reward = GRADE_POINTS[g];
      submitScore(META.id, '我', reward);
      if (reward > 0) addPoints(reward);
      setPhase('over');
    } else {
      setPhase('roundDone');
      timerRef.current = window.setTimeout(armRound, 900);
    }
  };

  const lastRound = rounds[rounds.length - 1];
  const avg = rounds.length ? Math.round(rounds.reduce((s, t) => s + t.ms, 0) / rounds.length) : 0;
  const reward = grade ? GRADE_POINTS[grade] : 0;

  return (
    <div className="min-h-dvh flex flex-col text-white bg-slate-900">
      <header className="flex items-center gap-3 p-4 relative z-10">
        <button onClick={() => navigate('/games')} className="p-2 -ml-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">{META.icon} {META.title}</h1>
        <span className="ml-auto text-sm opacity-80">余额 {wallet.points}</span>
      </header>

      {phase === 'pick' ? (
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
                    level === i ? 'bg-emerald-400 text-slate-900' : 'bg-white/10 text-white'
                  } ${locked ? 'opacity-40' : 'active:scale-95'}`}
                >
                  <div className="font-black flex items-center gap-1.5">
                    {locked && <Lock className="w-4 h-4" />} {lv.title}
                  </div>
                  <div className={`text-xs mt-1 ${level === i ? 'text-slate-600' : 'text-white/60'}`}>
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
            className="h-16 px-10 rounded-2xl bg-emerald-400 text-slate-900 font-black text-xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            {wallet.points >= META.entryFee ? `支付 ${META.entryFee} 积分 · 挑战${META.levels[level].title}` : '积分不足'}
          </button>
          <p className="text-xs text-white/50">S=+30 A=+24 B=+18 C=+12 D=+8 E=+4 F=+0</p>
        </main>
      ) : phase === 'over' && grade ? (
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <span className={`w-28 h-28 rounded-full text-6xl font-black flex items-center justify-center ${GRADE_STYLE[grade]}`}>
            {grade}
          </span>
          <h2 className="text-2xl font-black">平均反应 {avg}ms</h2>
          <p className="text-white/80">
            {grade === 'F'
              ? '没达到过关线，稳住再来！'
              : <>获得 <b className="text-emerald-300">+{reward}</b> 积分{level === progress.unlocked - 1 && level < 5 && '，下一关已解锁！'}</>}
          </p>
          <p className="text-white/50 text-sm">
            {rounds.map((r) => (r.early ? '抢跑' : `${r.ms}ms`)).join(' · ')}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPhase('pick')} className="h-14 px-8 rounded-2xl bg-emerald-400 text-slate-900 font-black">
              再来一次
            </button>
            <button onClick={() => navigate('/games')} className="h-14 px-8 rounded-2xl bg-white/15 font-bold">
              返回游戏厅
            </button>
          </div>
        </main>
      ) : (
        <button
          onPointerDown={tap}
          className={`flex-1 flex flex-col items-center justify-center gap-4 select-none touch-none transition-colors ${
            phase === 'go'
              ? 'bg-emerald-400 text-slate-900'
              : phase === 'fake'
                ? 'bg-amber-400 text-slate-900'
                : phase === 'wait'
                  ? 'bg-red-500'
                  : 'bg-slate-700'
          }`}
        >
          {phase === 'wait' && (
            <>
              <span className="text-4xl font-black">等待变绿…</span>
              <span className="text-white/70">{cfg.fake ? '黄光是假信号，别点！' : '不要抢跑！'}</span>
            </>
          )}
          {phase === 'fake' && <span className="text-5xl font-black">点我！</span>}
          {phase === 'go' && <span className="text-5xl font-black">点我！</span>}
          {phase === 'roundDone' && lastRound && (
            <span className="text-4xl font-black">
              {lastRound.early ? '抢跑！罚 1000ms' : `${lastRound.ms}ms`}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
