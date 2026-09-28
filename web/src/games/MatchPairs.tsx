import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { spendPoints, addPoints, useWallet } from '@/core/wallet';
import { submitScore } from '@/core/leaderboard';
import { MINI_GAMES } from '@/games/registry';
import {
  GRADE_POINTS,
  GRADE_STYLE,
  getProgress,
  gradeHigherIsBetter,
  recordGrade,
  type GradeLetter,
} from '@/games/levels';
import type { MathExpr } from '@/core/types';
import MathView from '@/components/MathView';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Lock } from 'lucide-react';

const META = MINI_GAMES.find((g) => g.id === 'match-pairs')!;
const ROUND_MS = 60_000;
const WRONG_PENALTY_MS = 2_000; // 配错扣 2 秒：防瞎点

type Form = 'frac' | 'decimal' | 'unreduced' | 'percent' | 'mixed' | 'improper';

/** 关卡配置：牌数 + 可用形态 + 评级线（60 秒配对数，越多越好） */
const LEVELS: { cards: number; forms: Form[]; t: number[] }[] = [
  { cards: 4, forms: ['frac', 'decimal'], t: [12, 10, 8, 7, 6, 5] },
  { cards: 4, forms: ['frac', 'decimal', 'unreduced'], t: [11, 9, 8, 7, 6, 5] },
  { cards: 4, forms: ['frac', 'decimal', 'unreduced', 'percent'], t: [11, 9, 8, 7, 6, 5] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent'], t: [10, 9, 8, 6, 5, 4] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent', 'mixed', 'improper'], t: [10, 9, 8, 6, 5, 4] },
  { cards: 6, forms: ['frac', 'decimal', 'unreduced', 'percent', 'mixed', 'improper'], t: [12, 10, 9, 7, 6, 5] },
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const DENOMS = [2, 4, 5, 8, 10];

interface Family {
  value: number; // 精确小数值
  big: boolean; // 是否带整数部分
  w: number;
  n: number;
  d: number;
}

/** 全部数值家族：小于 1 的真分数族 + 大于 1 的带分数族（分母保证除得尽） */
const FAMILIES: Family[] = (() => {
  const list: Family[] = [];
  for (const d of DENOMS)
    for (let n = 1; n < d; n++)
      if (gcd(n, d) === 1) list.push({ value: n / d, big: false, w: 0, n, d });
  for (const w of [1, 2])
    for (const d of DENOMS)
      for (let n = 1; n < d; n++)
        if (gcd(n, d) === 1) list.push({ value: w + n / d, big: true, w, n, d });
  return list;
})();

function decimalText(f: Family): string {
  const scaled = f.w * 1000 + f.n * (1000 / f.d);
  const s = String(scaled).padStart(4, '0');
  return `${s.slice(0, -3)}.${s.slice(-3)}`.replace(/0+$/, '').replace(/\.$/, '');
}

function applicableForms(f: Family): Form[] {
  return f.big ? ['mixed', 'decimal', 'improper', 'percent'] : ['frac', 'decimal', 'unreduced', 'percent'];
}

function renderForm(f: Family, form: Form): MathExpr {
  switch (form) {
    case 'frac':
      return { kind: 'frac', n: String(f.n), d: String(f.d) };
    case 'unreduced': {
      const k = f.d <= 4 ? 3 : 2; // 2/4、3/6、2/10 这类"没约分"形态
      return { kind: 'frac', n: String(f.n * k), d: String(f.d * k) };
    }
    case 'decimal':
      return { kind: 'text', text: decimalText(f) };
    case 'percent':
      return { kind: 'text', text: `${f.value * 100}%` };
    case 'mixed':
      return { kind: 'mixed', whole: String(f.w), n: String(f.n), d: String(f.d) };
    case 'improper':
      return { kind: 'frac', n: String(f.w * f.d + f.n), d: String(f.d) };
  }
}

interface Card {
  id: number;
  expr: MathExpr;
  value: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 生成一局牌：恰好一对等值，其余互不相等 */
function genRound(cfg: (typeof LEVELS)[number]): Card[] {
  const pool = shuffle(FAMILIES.filter((f) => applicableForms(f).filter((x) => cfg.forms.includes(x)).length >= 1));
  // 找一对：需要一个家族有 ≥2 种可用形态
  let pairFam: Family | undefined;
  let pairForms: Form[] = [];
  for (const f of pool) {
    const forms = applicableForms(f).filter((x) => cfg.forms.includes(x));
    if (forms.length >= 2) {
      pairFam = f;
      pairForms = shuffle(forms).slice(0, 2);
      break;
    }
  }
  if (!pairFam) return [];
  const cards: Card[] = pairForms.map((form, i) => ({
    id: i,
    expr: renderForm(pairFam!, form),
    value: pairFam!.value,
  }));
  // 单牌：与对子及彼此值都不同
  const used = new Set([pairFam.value]);
  for (const f of pool) {
    if (cards.length >= cfg.cards) break;
    if (used.has(f.value)) continue;
    const forms = applicableForms(f).filter((x) => cfg.forms.includes(x));
    if (!forms.length) continue;
    used.add(f.value);
    cards.push({ id: cards.length, expr: renderForm(f, forms[0]), value: f.value });
  }
  return shuffle(cards).map((c, i) => ({ ...c, id: i }));
}

type Phase = 'pick' | 'play' | 'over';

/** 等值扑克（关卡制）：反应 + 工作记忆 + 数感（同一数值的不同形态互认） */
export default function MatchPairs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wallet = useWallet();
  const [level, setLevel] = useState(() =>
    Math.min(Math.max(Number(searchParams.get('level') ?? 0), 0), 5),
  );
  const [phase, setPhase] = useState<Phase>('pick');
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pairs, setPairs] = useState(0);
  const [leftMs, setLeftMs] = useState(ROUND_MS);
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [grade, setGrade] = useState<GradeLetter | null>(null);
  const [progress, setProgress] = useState(() => getProgress(META.id));
  const endAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const pairsRef = useRef(0);

  const cfg = LEVELS[level];

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (flashRef.current) window.clearTimeout(flashRef.current);
    },
    [],
  );

  const finish = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    const g = gradeHigherIsBetter(pairsRef.current, cfg.t);
    setGrade(g);
    recordGrade(META.id, level, g);
    setProgress(getProgress(META.id));
    submitScore(META.id, '我', pairsRef.current);
    const reward = GRADE_POINTS[g];
    if (reward > 0) addPoints(reward);
    setPhase('over');
  };

  const startGame = () => {
    if (!spendPoints(META.entryFee)) return;
    pairsRef.current = 0;
    setPairs(0);
    setGrade(null);
    setSelected(null);
    setCards(genRound(cfg));
    endAtRef.current = performance.now() + ROUND_MS;
    setLeftMs(ROUND_MS);
    setPhase('play');
    timerRef.current = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      setLeftMs(Math.max(0, left));
      if (left <= 0) finish();
    }, 100);
  };

  const tapCard = (c: Card) => {
    if (phase !== 'play' || flash) return;
    if (selected === null) {
      setSelected(c.id);
      return;
    }
    if (selected === c.id) {
      setSelected(null);
      return;
    }
    const first = cards.find((x) => x.id === selected)!;
    setSelected(null);
    if (Math.abs(first.value - c.value) < 1e-9) {
      // 配对成功：+1 对，立刻下一组
      pairsRef.current += 1;
      setPairs(pairsRef.current);
      setFlash('good');
      flashRef.current = window.setTimeout(() => {
        setFlash(null);
        setCards(genRound(cfg));
      }, 350);
    } else {
      // 配错：扣 2 秒
      endAtRef.current -= WRONG_PENALTY_MS;
      setFlash('bad');
      flashRef.current = window.setTimeout(() => setFlash(null), 350);
    }
  };

  const reward = grade ? GRADE_POINTS[grade] : 0;
  const pct = (leftMs / ROUND_MS) * 100;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-600 to-blue-800 text-white flex flex-col">
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
                    level === i ? 'bg-white text-sky-700' : 'bg-white/15 text-white'
                  } ${locked ? 'opacity-40' : 'active:scale-95'}`}
                >
                  <div className="font-black flex items-center gap-1.5">
                    {locked && <Lock className="w-4 h-4" />} {lv.title}
                  </div>
                  <div className={`text-xs mt-1 ${level === i ? 'text-sky-500' : 'text-white/60'}`}>
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
            className="h-16 px-10 rounded-2xl bg-white text-sky-700 font-black text-xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            {wallet.points >= META.entryFee ? `支付 ${META.entryFee} 积分 · 挑战${META.levels[level].title}` : '积分不足'}
          </button>
          <p className="text-xs text-white/50">配错一对扣 2 秒 · S=+30 A=+24 B=+18 C=+12 D=+8 E=+4</p>
        </main>
      )}

      {phase === 'play' && (
        <main className="flex-1 flex flex-col px-4 gap-4">
          <div className="pt-2">
            <div className="flex justify-between text-sm font-bold mb-1">
              <span>已配对 {pairs} 对</span>
              <span className={leftMs <= 10000 ? 'text-red-300' : 'text-white/70'}>
                {Math.ceil(leftMs / 1000)}s
              </span>
            </div>
            <Progress value={pct} className={`h-3 bg-white/20 ${leftMs <= 10000 ? '[&>div]:bg-red-400' : '[&>div]:bg-amber-300'}`} />
          </div>
          <p className="text-center text-white/70 text-sm">点两张值相等的牌（配错扣 2 秒）</p>
          <div className={`grid grid-cols-2 gap-3 max-w-md mx-auto w-full flex-1 content-center`}>
            {cards.map((c) => (
              <button
                key={c.id}
                onClick={() => tapCard(c)}
                className={`h-28 rounded-3xl text-4xl font-black flex items-center justify-center transition-all active:scale-95 ${
                  flash === 'good'
                    ? 'bg-emerald-400 text-emerald-900'
                    : flash === 'bad'
                      ? 'bg-red-300 text-red-800'
                      : selected === c.id
                        ? 'bg-amber-300 text-amber-900 scale-95'
                        : 'bg-white text-slate-800'
                }`}
              >
                <MathView expr={c.expr} />
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
          <h2 className="text-2xl font-black">60 秒配对 {pairsRef.current} 对</h2>
          <p className="text-white/80">
            {grade === 'F'
              ? '没达到过关线，再练一次吧'
              : <>获得 <b className="text-amber-300">+{reward}</b> 积分{level === progress.unlocked - 1 && level < 5 && '，下一关已解锁！'}</>}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPhase('pick')} className="h-14 px-8 rounded-2xl bg-white text-sky-700 font-black">
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
