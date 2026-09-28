/**
 * HGE2 关卡机制实现。每个机制组件占满外壳给的区域（absolute inset-0 全屏），
 * 完成时调用 onFinish(metric)；失败/出局调用 onFinish(null)（评 F）。
 * onExit 为中途退出（返回选关，不评级）。
 * 计时一律用 performance.now()，不依赖 rAF，保证后台/面板场景数值正确。
 * UI 原则：大号拉丁/数字才用 3D 描边，中文一律普通粗体；图形粗黑描边手绘风。
 */
import { useEffect, useRef, useState } from 'react';

export interface MechProps {
  onFinish: (metric: number | null) => void;
  onExit?: () => void;
}

/* ---------------- 共用：短音效 ---------------- */
let audioCtx: AudioContext | null = null;
function tone(freq: number, dur = 0.09, type: OscillatorType = 'sine', vol = 0.07) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new AC();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur + 0.02);
  } catch {
    /* 无音频环境时静默 */
  }
}
const blip = () => tone(480 + Math.random() * 320);
const buzz = () => tone(160, 0.18, 'square', 0.06);

/* ---------------- 共用：满屏红黄蓝三赛道 ---------------- */
const LANE_COLORS = ['#E53935', '#FDD835', '#1E88E5'];
function Lanes() {
  return (
    <div className="absolute inset-0 grid grid-cols-3">
      {LANE_COLORS.map((c) => (
        <div key={c} style={{ background: c }} />
      ))}
    </div>
  );
}

/* ---------------- 共用：左上角黄色 3D 计数 + 蓝色单位标签 ---------------- */
function BigCounter({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="absolute top-2 left-2 z-20 flex items-start">
      <span
        className="font-black tabular-nums"
        style={{
          fontSize: '3rem',
          lineHeight: 1,
          color: '#FFD83D',
          WebkitTextStroke: '2.5px #8a4500',
          textShadow: '3px 3px 0 rgba(0,0,0,.35)',
        }}
      >
        {value}
      </span>
      <span
        className="ml-1 mt-2 px-1.5 py-0.5 text-sm font-black text-white rounded"
        style={{ background: '#1E88E5', border: '2px solid #0d47a1' }}
      >
        {unit}
      </span>
    </div>
  );
}

/* ---------------- 共用：右上角重开/退出小按钮（原版样式） ---------------- */
function CornerButtons({ onRestart, onExit }: { onRestart: () => void; onExit?: () => void }) {
  return (
    <div className="absolute top-2 right-2 z-20 flex gap-2">
      <button
        onClick={onRestart}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-black active:scale-90"
        style={{ background: '#263238', border: '2px solid #101518', boxShadow: '0 3px 0 rgba(0,0,0,.4)' }}
      >
        ↻
      </button>
      {onExit && (
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-black active:scale-90"
          style={{ background: '#263238', border: '2px solid #101518', boxShadow: '0 3px 0 rgba(0,0,0,.4)' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ---------------- 手绘 SVG：卡通大脚丫（临摹原版：五趾分开、大脚趾最大、收出脚后跟） ---------------- */
function FootSvg() {
  const skin = '#F8C08E';
  const outline = '#4A2C14';
  return (
    <svg viewBox="0 0 150 190" className="w-full h-full" style={{ filter: 'drop-shadow(4px 5px 0 rgba(0,0,0,.25))' }}>
      <path
        d="M30 48 C15 76 15 124 42 154 C64 176 108 172 120 136 C130 106 124 66 110 46 C90 58 50 58 30 48 Z"
        fill={skin}
        stroke={outline}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <ellipse cx="36" cy="33" rx="15" ry="18" fill={skin} stroke={outline} strokeWidth="6" />
      <ellipse cx="65" cy="21" rx="11" ry="13" fill={skin} stroke={outline} strokeWidth="6" />
      <ellipse cx="87" cy="18" rx="10" ry="12" fill={skin} stroke={outline} strokeWidth="6" />
      <ellipse cx="106" cy="22" rx="9" ry="11" fill={skin} stroke={outline} strokeWidth="6" />
      <ellipse cx="122" cy="31" rx="8" ry="10" fill={skin} stroke={outline} strokeWidth="6" />
      <ellipse cx="36" cy="28" rx="6.5" ry="5" fill="#FDE6D0" stroke={outline} strokeWidth="2.5" />
      <path d="M44 78 C62 66 92 66 108 80" fill="none" stroke="#D98E55" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="76" cy="122" rx="20" ry="26" fill="#E89B62" opacity="0.45" />
    </svg>
  );
}

/* ---------------- 手绘 SVG：白羽毛（临摹原版：弯曲羽轴 + 两侧蓬松绒羽丝） ---------------- */
function FeatherSvg() {
  return (
    <svg viewBox="0 0 60 60" className="w-11 h-11">
      <path
        d="M28 56 C19 45 15 30 23 16 C29 6 40 3 45 6 C53 11 52 25 46 37 C40 49 34 55 28 56 Z"
        fill="#ffffff"
        stroke="#212121"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M28 56 C30 42 34 24 42 8" fill="none" stroke="#212121" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M31 45 C27 43 24 41 22 38 M33 36 C29 34 26 31 25 28 M36 27 C33 25 31 22 30 19 M38 18 C36 16 35 14 34 11" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 48 C37 47 41 45 43 42 M34 39 C39 38 43 35 45 32 M37 29 C42 28 45 26 47 22 M39 20 C43 19 46 16 47 13" fill="none" stroke="#212121" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- 第 1 关：不要挠我 ----------------
 * 满屏红黄蓝三赛道；脚丫出现在某赛道，点对应羽毛挠它；点错不扣分。
 * 指标 = 7 秒挠痒次数。评级线 S25 A24 B23 C22 D21 E20（原版）。 */
interface Laugh {
  id: number;
  x: number;
}

function TickleGame({ onFinish, onExit }: MechProps) {
  const TOTAL_MS = 7000;
  const [count, setCount] = useState(0);
  const [leftMs, setLeftMs] = useState(TOTAL_MS);
  const [lane, setLane] = useState(() => Math.floor(Math.random() * 3));
  const [squash, setSquash] = useState(0);
  const [laughs, setLaughs] = useState<Laugh[]>([]);
  const startRef = useRef(performance.now());
  const countRef = useRef(0);
  const laneRef = useRef(lane);
  const doneRef = useRef(false);
  const laughId = useRef(0);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const remain = Math.max(0, TOTAL_MS - (performance.now() - startRef.current));
      setLeftMs(remain);
      if (remain <= 0 && !doneRef.current) {
        doneRef.current = true;
        window.clearInterval(tick);
        onFinish(countRef.current);
      }
    }, 50);
    const move = window.setInterval(() => {
      setLane((p) => {
        let n = p;
        while (n === p) n = Math.floor(Math.random() * 3);
        laneRef.current = n;
        return n;
      });
    }, 700);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(move);
    };
  }, [onFinish]);

  const press = (i: number) => {
    if (doneRef.current) return;
    if (i !== laneRef.current) return; // 原版：点错不扣分，无反馈
    countRef.current += 1;
    setCount(countRef.current);
    setSquash((s) => s + 1);
    blip();
    if (navigator.vibrate) navigator.vibrate(8);
    const id = ++laughId.current;
    setLaughs((ls) => [...ls.slice(-5), { id, x: 10 + Math.random() * 80 }]);
    window.setTimeout(() => setLaughs((ls) => ls.filter((l) => l.id !== id)), 550);
  };

  return (
    <div className="absolute inset-0 select-none overflow-hidden">
      <Lanes />
      <BigCounter value={String(count).padStart(3, '0')} unit="分" />
      <CornerButtons
        onRestart={() => {
          if (doneRef.current) return;
          startRef.current = performance.now();
          countRef.current = 0;
          setCount(0);
        }}
        onExit={onExit}
      />
      <span
        className="absolute right-3 z-20 font-black text-white"
        style={{ bottom: 100, fontSize: '1.6rem', WebkitTextStroke: '1.5px #37474f', textShadow: '2px 2px 0 rgba(0,0,0,.4)' }}
      >
        {(leftMs / 1000).toFixed(1)}
      </span>

      {/* 大胖脚丫：横跨赛道居中（原版占屏宽近一半） */}
      <div
        key={lane}
        className="absolute z-10"
        style={{
          left: `${lane * 33.333 - 6}%`,
          width: '45%',
          top: '22%',
          aspectRatio: '150/190',
          animation: 'hge2drop .16s ease-out',
        }}
      >
        <div className="w-full h-full" style={{ animation: 'hge2wiggle .6s ease-in-out infinite' }}>
          <div key={squash} className="w-full h-full" style={{ animation: squash ? 'hge2squash .2s ease-out' : undefined }}>
            <FootSvg />
          </div>
        </div>
        {laughs.map((lau) => (
          <span
            key={lau.id}
            className="absolute font-black pointer-events-none"
            style={{
              left: `${lau.x}%`,
              top: '22%',
              fontSize: '1.5rem',
              color: '#fff',
              WebkitTextStroke: '1.5px #8a4500',
              animation: 'hge2laugh .55s ease-out forwards',
            }}
          >
            哈
          </span>
        ))}
      </div>

      {/* 底部：3 个白底黑边羽毛按钮（原版样式） */}
      <div className="absolute bottom-0 inset-x-0 z-20 grid grid-cols-3 pb-2 pt-1">
        {LANE_COLORS.map((c, i) => (
          <div key={c} className="flex items-center justify-center">
            <button
              data-feather={i}
              onPointerDown={() => press(i)}
              className="w-20 h-20 bg-white rounded-xl flex items-center justify-center active:translate-y-1 touch-none"
              style={{ border: '4px solid #212121', boxShadow: '0 5px 0 rgba(0,0,0,.55)' }}
            >
              <FeatherSvg />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 手绘 SVG：石头剪刀布卡通手（临摹原版：大肉圆拳头 + 拇指圆 + 手指褶皱弧线，默认指向右） ---------------- */
function HandSvg({ hand }: { hand: 'r' | 's' | 'p' }) {
  const skin = '#F5C9A8';
  const outline = '#4A2C14';
  const p = { fill: skin, stroke: outline, strokeWidth: 6, strokeLinejoin: 'round' as const };
  const crease = { fill: 'none', stroke: outline, strokeWidth: 4.5, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full" style={{ filter: 'drop-shadow(4px 5px 0 rgba(0,0,0,.25))' }}>
      {hand === 'r' && (
        <>
          {/* 手腕 */}
          <rect x="0" y="52" width="80" height="40" rx="18" {...p} />
          {/* 大肉圆拳头 */}
          <circle cx="112" cy="70" r="46" {...p} />
          {/* 拇指圆（压在前侧） */}
          <circle cx="140" cy="58" r="16" {...p} />
          {/* 三根蜷指褶皱弧线 */}
          <path d="M98 34 C110 42 114 52 110 60" {...crease} />
          <path d="M94 62 C106 70 110 80 106 88" {...crease} />
          <path d="M90 90 C102 98 106 108 102 116" {...crease} />
        </>
      )}
      {hand === 'p' && (
        <>
          {/* 手腕 + 大肉圆手掌 */}
          <rect x="0" y="55" width="72" height="38" rx="17" {...p} />
          <circle cx="100" cy="72" r="42" {...p} />
          {/* 四指：向右微扇形伸出的圆头胶囊 */}
          <rect x="126" y="26" width="64" height="17" rx="8.5" transform="rotate(-6 126 34)" {...p} />
          <rect x="132" y="48" width="66" height="17" rx="8.5" {...p} />
          <rect x="132" y="70" width="64" height="17" rx="8.5" {...p} />
          <rect x="126" y="92" width="56" height="16" rx="8" transform="rotate(6 126 100)" {...p} />
          {/* 拇指圆 */}
          <circle cx="88" cy="102" r="15" {...p} />
        </>
      )}
      {hand === 's' && (
        <>
          {/* 手腕 + 大肉圆手掌 */}
          <rect x="0" y="55" width="72" height="38" rx="17" {...p} />
          <circle cx="98" cy="72" r="40" {...p} />
          {/* V 形伸出的食指/中指 */}
          <rect x="112" y="24" width="80" height="17" rx="8.5" transform="rotate(-18 112 32)" {...p} />
          <rect x="112" y="101" width="80" height="17" rx="8.5" transform="rotate(18 112 109)" {...p} />
          {/* 蜷缩的无名指/小指：两个小疙瘩 + 褶皱 */}
          <circle cx="124" cy="58" r="9.5" {...p} />
          <circle cx="124" cy="86" r="9.5" {...p} />
          <path d="M110 50 C116 54 118 60 116 66 M110 80 C116 84 118 90 116 96" {...crease} />
          {/* 拇指圆 */}
          <circle cx="78" cy="46" r="14" {...p} />
        </>
      )}
    </svg>
  );
}

/* ---------------- 第 2 关：石头剪刀布（原版复刻） ----------------
 * 红方（左）vs 蓝方（右）出拳，判断 红方胜/平局/蓝方胜，共 20 局。
 * 判对按速度得 1-6 分，判错扣 3 分；左上计数为本局毫秒数（原版样式）。
 * 指标 = 总分。评级线 S30 A27 B24 C21 D18 E15（原版）。 */
type Hand = 'r' | 's' | 'p';
const HANDS: Hand[] = ['r', 's', 'p'];
const RPS_ROUNDS = 20;

const randHand = () => HANDS[Math.floor(Math.random() * 3)];

function rpsWinner(l: Hand, r: Hand): 'left' | 'draw' | 'right' {
  if (l === r) return 'draw';
  if ((l === 'r' && r === 's') || (l === 's' && r === 'p') || (l === 'p' && r === 'r')) return 'left';
  return 'right';
}

const speedPts = (ms: number) => (ms < 700 ? 6 : ms < 1000 ? 5 : ms < 1300 ? 4 : ms < 1700 ? 3 : ms < 2200 ? 2 : 1);

interface RpsPop {
  id: number;
  text: string;
  ok: boolean;
}

function RPSGame({ onFinish, onExit }: MechProps) {
  const [round, setRound] = useState(1);
  const [hands, setHands] = useState<[Hand, Hand]>(() => [randHand(), randHand()]);
  const [score, setScore] = useState(0);
  const [ms, setMs] = useState(0);
  const [pop, setPop] = useState<RpsPop | null>(null);
  const [result, setResult] = useState<{ actual: 'left' | 'draw' | 'right'; ok: boolean } | null>(null);
  const roundStartRef = useRef(performance.now());
  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const busyRef = useRef(false);
  const popId = useRef(0);

  useEffect(() => {
    const iv = window.setInterval(() => setMs(performance.now() - roundStartRef.current), 50);
    return () => window.clearInterval(iv);
  }, []);

  const restart = () => {
    scoreRef.current = 0;
    roundRef.current = 1;
    busyRef.current = false;
    setScore(0);
    setRound(1);
    setPop(null);
    setResult(null);
    setHands([randHand(), randHand()]);
    roundStartRef.current = performance.now();
  };

  const answer = (pick: 'left' | 'draw' | 'right') => {
    if (busyRef.current) return;
    busyRef.current = true;
    const elapsed = performance.now() - roundStartRef.current;
    const actual = rpsWinner(hands[0], hands[1]);
    const ok = pick === actual;
    const delta = ok ? speedPts(elapsed) : -3;
    if (ok) blip();
    else buzz();
    scoreRef.current += delta;
    setScore(scoreRef.current);
    setPop({ id: ++popId.current, text: (delta > 0 ? '+' : '') + delta, ok });
    setResult({ actual, ok });
    const isLast = roundRef.current >= RPS_ROUNDS;
    window.setTimeout(() => {
      setPop(null);
      setResult(null);
      if (isLast) {
        onFinish(scoreRef.current);
      } else {
        roundRef.current += 1;
        setRound(roundRef.current);
        setHands([randHand(), randHand()]);
        roundStartRef.current = performance.now();
        busyRef.current = false;
      }
    }, 480);
  };

  // 结果动效：胜方前冲放大，负方缩小旋转消失，平局一起下蹲
  const leftAnim = result
    ? result.actual === 'left'
      ? 'hge2winL .45s ease-out forwards'
      : result.actual === 'draw'
        ? 'hge2drawtie .45s ease-out'
        : 'hge2lose .45s ease-in forwards'
    : undefined;
  const rightAnim = result
    ? result.actual === 'right'
      ? 'hge2winR .45s ease-out forwards'
      : result.actual === 'draw'
        ? 'hge2drawtie .45s ease-out'
        : 'hge2lose .45s ease-in forwards'
    : undefined;

  return (
    <div className="absolute inset-0 select-none overflow-hidden">
      <Lanes />
      <BigCounter value={String(Math.min(9999, Math.floor(ms))).padStart(4, '0')} unit="毫秒" />
      <CornerButtons onRestart={restart} onExit={onExit} />

      {/* 左上的小字：得分与局数 */}
      <div className="absolute z-20" style={{ top: 64, left: 12 }}>
        <div className="font-black text-white text-lg" style={{ textShadow: '1px 2px 0 rgba(0,0,0,.45)' }}>
          得分 {score}
        </div>
        <div className="font-bold text-white/80 text-sm" style={{ textShadow: '1px 1px 0 rgba(0,0,0,.45)' }}>
          第 {round}/{RPS_ROUNDS} 局
        </div>
      </div>

      {/* 两只大手：红方在黄线左、蓝方在黄线右，出拳入场 + 胜负动效 */}
      <div data-l={hands[0]} data-r={hands[1]} className="hidden" />
      <div
        key={`L${round}`}
        className="absolute z-10"
        style={{ left: '-2%', top: '28%', width: '44%', aspectRatio: '200/140', animation: 'hge2punchL .3s ease-out' }}
      >
        <div style={{ animation: leftAnim }}>
          <HandSvg hand={hands[0]} />
        </div>
      </div>
      <div
        key={`R${round}`}
        className="absolute z-10"
        style={{ right: '-2%', top: '28%', width: '44%', aspectRatio: '200/140', animation: 'hge2punchR .3s ease-out' }}
      >
        <div style={{ animation: rightAnim }}>
          <div style={{ transform: 'scaleX(-1)' }}>
            <HandSvg hand={hands[1]} />
          </div>
        </div>
      </div>

      {/* 答对/答错反馈 */}
      {pop && (
        <span
          key={pop.id}
          className="absolute z-30 font-black pointer-events-none"
          style={{
            left: '50%',
            top: '24%',
            transform: 'translateX(-50%)',
            fontSize: '3.4rem',
            color: pop.ok ? '#76FF03' : '#FF5252',
            WebkitTextStroke: '2.5px #212121',
            textShadow: '3px 3px 0 rgba(0,0,0,.35)',
            animation: 'hge2popfade .45s ease-out forwards',
          }}
        >
          {pop.text}
        </span>
      )}

      {/* 底部：红方胜 / 平局 / 蓝方胜（原版白卡黑边按钮） */}
      <div className="absolute bottom-0 inset-x-0 z-20 grid grid-cols-3 gap-2 p-2">
        {(
          [
            ['left', '红方胜', '#E53935'],
            ['draw', '平局', '#37474F'],
            ['right', '蓝方胜', '#1E88E5'],
          ] as const
        ).map(([key, label, color]) => (
          <button
            key={key}
            data-ans={key}
            onPointerDown={() => answer(key)}
            className="h-16 bg-white rounded-xl flex items-center justify-center font-black text-2xl active:translate-y-1 touch-none"
            style={{ color, border: '4px solid #212121', boxShadow: '0 5px 0 rgba(0,0,0,.55)' }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 机制注册表：新关卡开发完在这里登记 */
export const MECHANICS: Record<string, React.ComponentType<MechProps>> = {
  tickle: TickleGame,
  rps: RPSGame,
};
