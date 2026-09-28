/**
 * HGE2 复刻档外壳 —— UI 全面向原版对齐：
 * 选关 = 木板背景 + 蓝色光芒星形卡片；规则 = 绿底 + 白纸 + 评级标尺；
 * 游玩 = 满屏无页头；结算 = 卡通大评级字母。
 * 文字原则：只有大号拉丁字母/数字用 3D 描边；所有中文一律普通粗体，清晰优先。
 * 解锁规则：达 E 解锁下一关（占位关自动跳过）；F 需重打。
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { spendPoints, addPoints, useWallet } from '@/core/wallet';
import { submitScore } from '@/core/leaderboard';
import {
  GRADE_POINTS,
  GRADE_ORDER,
  getProgress,
  gradeHigherIsBetter,
  gradeLowerIsBetter,
  recordGrade,
  type GradeLetter,
} from '@/games/levels';
import { HGE2_TIERS, stageLocked, type StageDef } from './stages';
import { MECHANICS } from './mechanics';

type Phase = 'pick' | 'ready' | 'countdown' | 'play' | 'over';

const TIER_THEME: Record<string, { label: string; color: string; dark: string }> = {
  'hge2-easy': { label: 'EASY', color: '#FFA726', dark: '#8a4500' },
  'hge2-normal': { label: 'NORMAL', color: '#EF5350', dark: '#7f1d1d' },
  'hge2-hard': { label: 'HARD', color: '#AB47BC', dark: '#4a1160' },
  'hge2-insane': { label: 'INSANE', color: '#5C6BC0', dark: '#1a237e' },
};

const GRADE_COLOR: Record<GradeLetter, string> = {
  S: '#FFD83D',
  A: '#B388FF',
  B: '#64B5F6',
  C: '#81C784',
  D: '#B0BEC5',
  E: '#CFD8DC',
  F: '#E57373',
};

const GREEN = '#8BC34A';

/** 木板背景 */
const WOOD_BG: CSSProperties = {
  background:
    'repeating-linear-gradient(90deg, #8D6E63 0 62px, #795548 62px 66px), repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0 4px, transparent 4px 120px)',
};

/** 蓝色光芒（原版关卡卡底色） */
const SUNBURST: CSSProperties = {
  background: 'repeating-conic-gradient(from -90deg at 50% 50%, #64B5F6 0deg 14deg, #1E88E5 14deg 28deg)',
};

/** 五角星 SVG（原版关卡卡主体） */
function Star({ fill, stroke, dim }: { fill: string; stroke: string; dim?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={dim ? { filter: 'grayscale(.9) brightness(.75)' } : undefined}>
      <path
        d="M50 6 L62 38 L96 39 L69 60 L79 93 L50 74 L21 93 L31 60 L4 39 L38 38 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 大号拉丁/数字专用 3D 描边（中文禁用） */
const strokeText = (color: string, w: number, shadow = true): CSSProperties => ({
  WebkitTextStroke: `${w}px ${color}`,
  ...(shadow ? { textShadow: '3px 3px 0 rgba(0,0,0,.3)' } : {}),
});

/** 评级标尺（原版：黑轨 + 绿字母砖 + 数值 + 红色箭头） */
function GradeRuler({ stage }: { stage: StageDef }) {
  return (
    <div className="relative mx-4 mb-4 rounded-xl px-2.5 py-2.5" style={{ background: '#263238', border: '3px solid #101518' }}>
      <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 text-2xl" style={{ color: '#E53935', textShadow: '1px 1px 0 #7f1d1d' }}>
        ▶
      </span>
      <div className="grid grid-cols-6 gap-1.5">
        {GRADE_ORDER.slice(0, 6).map((g, i) => (
          <div key={g} className="text-center">
            <div
              className="rounded-md py-1 font-black text-white text-xl"
              style={{ background: '#7ED321', border: '2px solid #33691E', textShadow: '1px 2px 0 #33691E' }}
            >
              {g}
            </div>
            <div className="text-white text-xs font-bold mt-1 tabular-nums">{stage.fmt(stage.t[i]).split(' ')[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 橙色卡通大按钮（中文文字：普通粗体，不加描边） */
function ChunkyButton({
  onClick,
  disabled,
  children,
  color = '#FFA726',
  border = '#B25B00',
  textColor = '#ffffff',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  color?: string;
  border?: string;
  textColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-6 py-3 rounded-2xl font-black text-xl active:translate-y-1 transition-transform disabled:opacity-50"
      style={{
        color: textColor,
        background: `linear-gradient(${color}, ${border})`,
        border: `4px solid ${border}`,
        boxShadow: '0 5px 0 rgba(0,0,0,.4)',
      }}
    >
      {children}
    </button>
  );
}

export default function HGE2Tier() {
  const { tierId } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const tier = HGE2_TIERS.find((t) => t.id === tierId) ?? HGE2_TIERS[0];
  const theme = TIER_THEME[tier.id] ?? TIER_THEME['hge2-easy'];

  const [phase, setPhase] = useState<Phase>('pick');
  const [stageIdx, setStageIdx] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [grade, setGrade] = useState<GradeLetter | null>(null);
  const [metric, setMetric] = useState<number | null>(null);
  const [progress, setProgress] = useState(() => getProgress(tier.id));
  const timersRef = useRef<number[]>([]);

  const stage: StageDef = tier.stages[stageIdx];

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const enterReady = (i: number) => {
    setStageIdx(i);
    setGrade(null);
    setPhase('ready');
  };

  const payAndCountdown = () => {
    if (!spendPoints(tier.entryFee)) return;
    setCountdown(3);
    setPhase('countdown');
    [2, 1, 0].forEach((v, k) => {
      timersRef.current.push(
        window.setTimeout(() => {
          if (v === 0) setPhase('play');
          else setCountdown(v);
        }, (k + 1) * 700),
      );
    });
  };

  const handleFinish = useCallback(
    (m: number | null) => {
      setMetric(m);
      const g: GradeLetter =
        m === null
          ? 'F'
          : stage.higherBetter
            ? gradeHigherIsBetter(m, stage.t)
            : gradeLowerIsBetter(m, stage.t);
      setGrade(g);
      recordGrade(tier.id, stageIdx, g);
      setProgress(getProgress(tier.id));
      const reward = GRADE_POINTS[g];
      submitScore(tier.id, '我', reward);
      if (reward > 0) addPoints(reward);
      setPhase('over');
    },
    [stage, stageIdx, tier.id],
  );

  const Mech = stage.mechanic ? MECHANICS[stage.mechanic] : undefined;
  const nextStage = tier.stages[stageIdx + 1];
  const unlockedNext =
    grade && grade !== 'F' && nextStage && !nextStage.disabled && !!nextStage.mechanic;

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-slate-900">
      {/* ---------------- 选关：木板 + 星形关卡卡 ---------------- */}
      {phase === 'pick' && (
        <main className="flex-1 flex flex-col overflow-hidden" style={WOOD_BG}>
          <div className="flex-1 flex flex-col px-4 pt-3 pb-5 min-h-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/games')}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl active:scale-95"
                style={{ background: '#8d2f2f', border: '3px solid #5c1a1a', boxShadow: '0 3px 0 rgba(0,0,0,.4)' }}
              >
                🏠
              </button>
              <h1
                className="flex-1 text-center font-black tracking-widest"
                style={{ fontSize: '2.4rem', color: theme.color, ...strokeText(theme.dark, 2.5) }}
              >
                {theme.label}
              </h1>
              <span
                className="px-3 py-1.5 rounded-xl font-black text-amber-300 text-sm"
                style={{ background: 'rgba(0,0,0,.45)', border: '2px solid rgba(255,216,61,.5)' }}
              >
                ⚡{wallet.points}
              </span>
            </div>

            <div
              className="mt-3 flex-1 rounded-3xl p-3 min-h-0 flex"
              style={{
                background: 'linear-gradient(#7CB342, #558B2F)',
                border: '4px solid #33691E',
                boxShadow: 'inset 0 4px 10px rgba(255,255,255,.25), 0 6px 0 #33691E',
              }}
            >
              <div className="flex-1 grid grid-cols-2 gap-3" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
                {tier.stages.map((s, i) => {
                  const g = progress.grades[String(i)] as GradeLetter | undefined;
                  const locked = stageLocked(tier, progress.grades, i);
                  return (
                    <button
                      key={s.num}
                      disabled={locked}
                      onClick={() => enterReady(i)}
                      className="relative rounded-xl overflow-hidden active:scale-95 transition-transform"
                      style={{ ...SUNBURST, border: '3px solid #0d47a1', boxShadow: 'inset 0 0 24px rgba(13,71,161,.6)' }}
                    >
                      {/* 关卡号角标 */}
                      <span
                        className="absolute top-1 left-1 z-20 w-7 h-7 rounded-md flex items-center justify-center font-black text-white text-sm"
                        style={{ background: '#F5841F', border: '2px solid #8a4500' }}
                      >
                        {s.num}
                      </span>
                      {/* 星星 + 图标 */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative" style={{ width: '58%', aspectRatio: '1/1' }}>
                          <Star fill="#FFD83D" stroke="#B25B00" dim={locked} />
                          <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: '2rem' }}>{s.icon}</span>
                        </div>
                      </div>
                      {/* 评级字母（大号拉丁，保留描边） */}
                      {g && (
                        <span
                          className="absolute bottom-0.5 right-1.5 z-20 font-black"
                          style={{ fontSize: '2rem', color: GRADE_COLOR[g], ...strokeText('#212121', 2) }}
                        >
                          {g}
                        </span>
                      )}
                      {/* 锁定标注：黑底白字小胶囊，中文不加描边 */}
                      {locked && (
                        <span className="absolute inset-x-3 bottom-1.5 z-20 text-center text-xs font-bold text-white bg-black/60 rounded-full py-0.5">
                          {s.disabled ? '暂未开放' : s.mechanic ? '未解锁' : '即将上线'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ---------------- 规则说明：绿底 + 白纸 + 评级标尺 ---------------- */}
      {phase === 'ready' && (
        <main className="flex-1 flex flex-col overflow-y-auto" style={{ background: GREEN }}>
          <div className="flex items-center justify-between px-4 pt-3">
            <ChunkyButton onClick={payAndCountdown} disabled={wallet.points < tier.entryFee}>
              ▶ 开始（{tier.entryFee} 积分）
            </ChunkyButton>
            <button onClick={() => setPhase('pick')} className="font-bold text-white text-sm underline">
              返回选关
            </button>
          </div>

          <div className="relative mx-4 mt-6 mb-4 bg-white rounded-lg p-5 pt-6" style={{ border: '4px solid #212121', transform: 'rotate(-1.2deg)', boxShadow: '7px 8px 0 rgba(0,0,0,.22)' }}>
            {/* 蓝色胶带 */}
            <span
              className="absolute -top-4 left-5 px-4 py-1 font-bold text-white"
              style={{ background: '#4FC3F7', border: '2px solid #0277BD', transform: 'rotate(-5deg)' }}
            >
              说明
            </span>
            {/* 右上角木框小图 */}
            <div
              className="absolute -top-3 right-3 w-20 h-20 rounded-md flex items-center justify-center text-4xl"
              style={{ background: '#FFB74D', border: '5px solid #8D6E63', boxShadow: '2px 3px 0 rgba(0,0,0,.25)' }}
            >
              {stage.icon}
            </div>
            <h2 className="font-black" style={{ fontSize: '2rem', color: '#6D4C41' }}>
              关卡 {stage.num}
            </h2>
            <p className="font-bold text-lg" style={{ color: '#8D6E63' }}>
              {stage.name}
            </p>
            <ul className="mt-3 space-y-1.5 font-bold" style={{ color: '#5D4037' }}>
              {stage.rules.map((r, i) => (
                <li key={i}>· {r}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-bold" style={{ color: '#90A4AE' }}>
              S=+30 A=+24 B=+18 C=+12 D=+8 E=+4 F=+0
            </p>
          </div>

          <div className="mt-auto">
            <GradeRuler stage={stage} />
          </div>
        </main>
      )}

      {/* ---------------- 倒计时 ---------------- */}
      {phase === 'countdown' && (
        <main className="flex-1 flex items-center justify-center" style={{ background: GREEN }}>
          <span
            key={countdown}
            className="font-black"
            style={{
              fontSize: '9rem',
              color: '#FFD83D',
              WebkitTextStroke: '5px #B25B00',
              textShadow: '7px 7px 0 rgba(0,0,0,.3)',
              animation: 'hge2cd .65s ease-out',
            }}
          >
            {countdown}
          </span>
        </main>
      )}

      {/* ---------------- 游玩：满屏 ---------------- */}
      {phase === 'play' && Mech && (
        <main className="flex-1 relative overflow-hidden">
          <Mech onFinish={handleFinish} onExit={() => setPhase('pick')} />
        </main>
      )}

      {/* ---------------- 结算 ---------------- */}
      {phase === 'over' && grade && (
        <main className="flex-1 flex items-center justify-center px-6" style={{ background: GREEN }}>
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-6 text-center"
            style={{ border: '4px solid #212121', transform: 'rotate(-1deg)', boxShadow: '8px 9px 0 rgba(0,0,0,.25)' }}
          >
            <div
              className="font-black"
              style={{
                fontSize: '6rem',
                lineHeight: 1,
                color: GRADE_COLOR[grade],
                WebkitTextStroke: '4px #212121',
                textShadow: '5px 5px 0 rgba(0,0,0,.25)',
              }}
            >
              {grade}
            </div>
            <h2 className="mt-2 text-xl font-black" style={{ color: '#5D4037' }}>
              {stage.metricName}：{metric === null ? '挑战失败' : stage.fmt(metric)}
            </h2>
            <p className="mt-1 font-bold" style={{ color: '#8D6E63' }}>
              {grade === 'F' ? (
                '没达到过关线，稳住再来！'
              ) : (
                <>
                  获得 <b style={{ color: '#F5841F' }}>+{GRADE_POINTS[grade]}</b> 积分
                  {unlockedNext && `，「${nextStage!.name}」已解锁！`}
                </>
              )}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <ChunkyButton onClick={() => enterReady(stageIdx)}>再来一次</ChunkyButton>
              <ChunkyButton onClick={() => setPhase('pick')} color="#ECEFF1" border="#90A4AE" textColor="#546E7A">
                选关
              </ChunkyButton>
            </div>
          </div>
        </main>
      )}

      <style>{`
        @keyframes hge2cd { 0% { transform: scale(1.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes hge2drop { 0% { transform: translateY(-24%) scale(.75); opacity: 0; } 100% { transform: none; opacity: 1; } }
        @keyframes hge2wiggle { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes hge2squash { 0% { transform: scale(1.12, .85); } 100% { transform: scale(1); } }
        @keyframes hge2laugh { 0% { transform: translateY(0) scale(.7); opacity: 1; } 100% { transform: translateY(-56px) scale(1.25); opacity: 0; } }
        @keyframes hge2popfade { 0% { transform: translateX(-50%) scale(.6); opacity: 1; } 100% { transform: translateX(-50%) translateY(-30px) scale(1.2); opacity: 0; } }
        @keyframes hge2punchL { 0% { transform: translateX(-60%) scale(.6); opacity: 0; } 60% { transform: translateX(4%) scale(1.06); opacity: 1; } 100% { transform: none; } }
        @keyframes hge2punchR { 0% { transform: translateX(60%) scale(.6); opacity: 0; } 60% { transform: translateX(-4%) scale(1.06); opacity: 1; } 100% { transform: none; } }
        @keyframes hge2winL { 0% { transform: none; } 40% { transform: translateX(16%) scale(1.18); } 100% { transform: translateX(10%) scale(1.12); } }
        @keyframes hge2winR { 0% { transform: none; } 40% { transform: translateX(-16%) scale(1.18); } 100% { transform: translateX(-10%) scale(1.12); } }
        @keyframes hge2lose { 0% { transform: none; opacity: 1; } 100% { transform: scale(.45) rotate(30deg); opacity: 0; } }
        @keyframes hge2drawtie { 0%,100% { transform: none; } 50% { transform: scale(.9); } }
      `}</style>
    </div>
  );
}
