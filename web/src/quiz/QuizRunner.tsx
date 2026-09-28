import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { findSkill, generateQuiz } from '@/data/bank';
import { scoreAnswer, SCORE_RULES } from '@/core/scoring';
import { addPoints } from '@/core/wallet';
import { logSession } from '@/core/studyLog';
import { exprValue, modeParams, type Choice, type MathExpr, type Question, type QuizMode } from '@/core/types';
import MathView from '@/components/MathView';
import FitText from '@/components/FitText';
import { Progress } from '@/components/ui/progress';
import { Delete, Flame, X } from 'lucide-react';

type Phase = 'answering' | 'feedback' | 'done' | 'failed';

interface AnswerRecord {
  correct: boolean;
  timedOut: boolean;
  delta: number;
  timeUsedSec: number;
  wrongAttempts: number;
}

/* ---------------- 复习模式：填空输入解析 ---------------- */

type InputForm = 'int' | 'dec' | 'frac' | 'mixed';
interface ParsedInput {
  value: number;
  form: InputForm;
  /** 分数部分未约到最简 */
  reducible: boolean;
}

const gcdNum = (a: number, b: number): number => (b ? gcdNum(b, a % b) : a);

/** 解析填空输入：支持 整数 / 小数 / 分数(3/4) / 带分数(1 3/4，空格分隔)，可带负号 */
export function parseAnswerInput(s: string): ParsedInput | null {
  const t = s.trim();
  const neg = t.startsWith('-');
  const body = neg ? t.slice(1) : t;
  const sign = neg ? -1 : 1;
  if (/^\d+$/.test(body)) return { value: sign * Number(body), form: 'int', reducible: false };
  if (/^\d+\.\d+$/.test(body)) return { value: sign * parseFloat(body), form: 'dec', reducible: false };
  let m = body.match(/^(\d+)\/(\d+)$/);
  if (m && Number(m[2]) !== 0) {
    const n = Number(m[1]);
    const d = Number(m[2]);
    return { value: (sign * n) / d, form: 'frac', reducible: gcdNum(n, d) !== 1 };
  }
  m = body.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m && Number(m[3]) !== 0) {
    const n = Number(m[2]);
    const d = Number(m[3]);
    return { value: sign * (Number(m[1]) + n / d), form: 'mixed', reducible: gcdNum(n, d) !== 1 };
  }
  return null;
}

/** 幽灵占位槽：分数结构里还没填的位置，用虚线框提示"这里要填" */
function Ghost() {
  return (
    <span className="inline-block w-[0.55em] h-[0.85em] rounded-[0.15em] border-[0.07em] border-dashed border-slate-300 bg-slate-50 align-middle" />
  );
}

/** 分数槽位渲染：与 MathView 同款排版，空位显示幽灵框 */
function FracSlots({ n, d }: { n: string | null; d: string | null }) {
  return (
    <span
      className="inline-flex flex-col items-center justify-center leading-none align-middle"
      style={{ fontSize: '0.62em' }}
    >
      <span className="px-[0.15em] pb-[0.08em] border-b-[0.06em] border-current font-bold min-h-[1em] flex items-center justify-center">
        {n === null ? <Ghost /> : n}
      </span>
      <span className="px-[0.15em] pt-[0.08em] font-bold min-h-[1em] flex items-center justify-center">
        {d === null ? <Ghost /> : d}
      </span>
    </span>
  );
}

/** 填空输入实时预览：按下带分数/分数线键立即显示结构骨架，每步按键都有视觉反馈 */
function InputPreview({ s }: { s: string }) {
  if (!s) return <span className="text-slate-300 text-4xl font-bold">点键盘输入</span>;
  if (s.includes(' ')) {
    const [w, rest = ''] = s.split(' ');
    const [n, d = ''] = rest.split('/');
    return (
      <span className="inline-flex items-center gap-[0.12em]">
        <span>{w}</span>
        <FracSlots n={n || null} d={rest.includes('/') ? d || null : null} />
      </span>
    );
  }
  if (s.includes('/')) {
    const [n, d = ''] = s.split('/');
    return <FracSlots n={n || null} d={d || null} />;
  }
  return <span>{s}</span>;
}

/** 形式校验：数值相等后，还要满足题目要求的形式（最简分数/带分数/小数）。
 *  acceptImproper 时（四则组合题库放宽）：带分数答案也接受最简假分数
 *  allowUnreduced 时（通分题库）：正确答案故意保留同分母，跳过约分检查 */
function formError(parsed: ParsedInput, correct: MathExpr, acceptImproper = false, allowUnreduced = false): string | null {
  if (correct.kind === 'frac') {
    if (parsed.form !== 'frac') return '数值对了，但要写成分数形式';
    if (parsed.reducible && !allowUnreduced) return '数值对了，但还没约到最简';
  }
  if (correct.kind === 'mixed') {
    if (acceptImproper && parsed.form === 'frac') {
      if (parsed.reducible) return '数值对了，但还没约到最简';
      return null;
    }
    if (parsed.form !== 'mixed') return '数值对了，但要写成带分数形式';
    if (parsed.reducible) return '数值对了，但分数部分还没约到最简';
  }
  return null;
}

/**
 * 快问快答引擎（三模式）：
 * - 复习模式（?mode=review）：20 题、限时 ×1.5，填空作答（数字键盘 + 分数线 + 带分数空格），
 *   填错扣分并提示原因，可重填
 * - 闯关模式（默认）：10 题、基准限时，固定 4 选项直显，错选扣分置灰可重选
 * - 进阶模式（?mode=advanced）：10 题、限时 ×0.6，错一题或超时即出局得 0，全对总分 ×2
 */
/** 每题重答机制：首次作答 + 2 次重答 = 共 3 次机会；每次答错剩余时间 +5 秒；第 3 次答错直接判错过题 */
const RETRY_LIMIT = 2;
const RETRY_BONUS_SEC = 5;

export default function QuizRunner() {
  const { skillId } = useParams();
  const [searchParams] = useSearchParams();
  const mode: QuizMode =
    searchParams.get('mode') === 'advanced'
      ? 'advanced'
      : searchParams.get('mode') === 'review'
        ? 'review'
        : 'normal';
  const advanced = mode === 'advanced';
  const reviewMode = mode === 'review';
  const navigate = useNavigate();
  const skill = skillId ? findSkill(skillId) : undefined;
  const { count, timeLimitSec } = skill
    ? modeParams(skill, mode)
    : { count: 0, timeLimitSec: 10 };

  const questions: Question[] = useMemo(
    () => (skill ? generateQuiz(skill, Date.now(), count) : []),
    [skill, count],
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [streak, setStreak] = useState(0);
  const [earned, setEarned] = useState(0);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [timeLeft, setTimeLeft] = useState(timeLimitSec);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState(0);
  const [lastBreakdown, setLastBreakdown] = useState<string[]>([]);
  // 本题已答错记录：闯关=置灰选项 id 列表；复习=错误次数；共用 attempts 计数
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  // 复习模式填空内容
  const [input, setInput] = useState('');

  const startRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);

  const q = questions[index];

  // 每题选项的格子位置随机一次，作答过程中位置不变
  const slotOf = useMemo(() => {
    const map = new Map<string, number>();
    if (!q) return map;
    const slots = q.choices.map((_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    q.choices.forEach((c, i) => map.set(c.id, slots[i]));
    return map;
  }, [q]);

  const settle = useCallback(
    (choiceId: string | null, attemptCount: number) => {
      if (!skill || !q) return;
      if (timerRef.current) window.clearInterval(timerRef.current);
      const timedOut = choiceId === null;
      const elapsed = (performance.now() - startRef.current) / 1000;
      const choice = q.choices.find((c) => c.id === choiceId);
      const result = scoreAnswer({
        mode,
        correct: !!choice?.correct,
        timedOut,
        timeLeftSec: Math.max(0, timeLimitSec - elapsed),
        timeLimitSec,
        streak,
        wrongAttempts: attemptCount,
      });
      setPickedId(choiceId);
      setLastDelta(result.delta);
      setLastBreakdown(result.breakdown);
      setStreak(result.newStreak);
      setEarned((e) => e + result.delta);
      setRecords((r) => [
        ...r,
        {
          correct: !!choice?.correct,
          timedOut,
          delta: result.delta,
          timeUsedSec: elapsed,
          wrongAttempts: attemptCount,
        },
      ]);
      setPhase('feedback');
      advanceRef.current = window.setTimeout(() => {
        if (index + 1 >= questions.length) {
          setPhase('done');
          // 积分在结算页一次性入账，避免中途刷新重复入账
        } else {
          setIndex((i) => i + 1);
          setPickedId(null);
          setWrongIds([]);
          setAttempts(0);
          setInput('');
          setPhase('answering');
        }
      }, 1400);
    },
    [skill, q, mode, timeLimitSec, streak, index, questions.length],
  );

  // 闯关模式错选：扣分、+5 秒补偿、置灰、继续作答；第 3 次错直接判错过题
  const pickWrong = useCallback(
    (c: Choice) => {
      const penalty = SCORE_RULES.wrongPickPenalty;
      const used = attempts + 1;
      if (used > RETRY_LIMIT) {
        settle(c.id, used); // 机会用完：本题判错，进入下一题
        return;
      }
      startRef.current += RETRY_BONUS_SEC * 1000; // 剩余时间 +5 秒
      setAttempts(used);
      setWrongIds((w) => [...w, c.id]);
      setEarned((e) => e + penalty);
      setStreak(0);
      setLastDelta(penalty);
      setLastBreakdown([
        `选错 ${penalty} · +${RETRY_BONUS_SEC}s`,
        c.trap ?? '再想一想',
        `还剩 ${RETRY_LIMIT - used + 1} 次机会`,
      ]);
    },
    [attempts, settle],
  );

  // 进阶模式：错选/超时 → 本局结束
  const failRun = useCallback((choiceId: string | null) => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPickedId(choiceId);
    setPhase('failed');
  }, []);

  const onChoice = (c: Choice) => {
    if (phase !== 'answering' || wrongIds.includes(c.id)) return;
    if (advanced) {
      if (c.correct) settle(c.id, 0);
      else failRun(c.id);
      return;
    }
    if (c.correct) settle(c.id, attempts);
    else pickWrong(c);
  };

  /* ---------------- 复习模式：填空提交 ---------------- */

  // 填错统一处理：扣分 + 剩余时间 +5 秒 + 清空重输；第 3 次错直接判错过题
  const wrongSubmit = (msg: string) => {
    const used = attempts + 1;
    const penalty = SCORE_RULES.reviewWrongPenalty;
    if (used > RETRY_LIMIT) {
      const wrongChoice = q.choices.find((c) => !c.correct)!;
      settle(wrongChoice.id, used);
      return;
    }
    startRef.current += RETRY_BONUS_SEC * 1000;
    setAttempts(used);
    setEarned((e) => e + penalty);
    setStreak(0);
    setLastDelta(penalty);
    setLastBreakdown([msg, `填错 ${penalty} · +${RETRY_BONUS_SEC}s`, `还剩 ${RETRY_LIMIT - used + 1} 次机会`]);
    setInput(''); // 答错自动清空，直接重输
  };

  const submitInput = () => {
    if (phase !== 'answering' || !q || !skill) return;
    const parsed = parseAnswerInput(input);
    if (!parsed) {
      setLastDelta(0);
      setLastBreakdown(['格式不对：整数、小数、3/4 或 1 1/2（带分数用空格隔开）']);
      return;
    }
    const correct = q.choices.find((c) => c.correct)!;
    const correctVal = exprValue(correct.value);
    if (Math.abs(parsed.value - correctVal) < 1e-9) {
      const ferr = formError(parsed, correct.value, skill.acceptImproper, skill.allowUnreduced);
      if (ferr) {
        wrongSubmit(ferr);
        return;
      }
      settle(correct.id, attempts);
    } else {
      wrongSubmit('不对，再算一遍');
    }
  };

  /** 数字键盘按键约束：同一串里小数点/分数线/带分数空格各最多一个，且互相排斥 */
  const pressKey = (k: string) => {
    if (phase !== 'answering') return;
    setInput((s) => {
      if (k === 'back') return s.slice(0, -1);
      if (s.length >= 9) return s;
      if (/^\d$/.test(k)) return s + k;
      if (k === '-') return s === '' ? '-' : s; // 负号只能在最前
      if (k === '.') return s && s !== '-' && !/[./ ]/.test(s) ? s + '.' : s;
      if (k === '/') return s && s !== '-' && !s.includes('/') && !s.includes('.') && !/ $/.test(s) ? s + '/' : s;
      if (k === ' ') return s && s !== '-' && !/[./ ]/.test(s) ? s + ' ' : s;
      return s;
    });
  };

  // 每题倒计时（100ms 粒度驱动进度条）
  // 注意：依赖里不能放 attempts/settle——错选会更新它们导致 effect 重跑、计时被重置（刷时间 BUG）。
  // 用 ref 读取最新值，计时只随「换题 / 阶段变化」重置。
  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;
  const settleRef = useRef(settle);
  settleRef.current = settle;
  useEffect(() => {
    if (!skill || phase !== 'answering') return;
    startRef.current = performance.now();
    setTimeLeft(timeLimitSec);
    timerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      const left = timeLimitSec - elapsed;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        if (advanced) failRun(null);
        else settleRef.current(null, attemptsRef.current);
      }
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, phase, index, advanced, failRun, timeLimitSec]);

  // 复习模式：答对自动提交——结构完整（含 / . 或带分数空格）+ 数值正确 + 形式合规 + 600ms 无新按键。
  // 纯整数答案不自动提交，防止"想输 12 才按了 1"被提前结算。
  useEffect(() => {
    if (!reviewMode || phase !== 'answering' || !q || !skill) return;
    if (!input || !/[/. ]/.test(input)) return;
    const parsed = parseAnswerInput(input);
    if (!parsed) return;
    const correct = q.choices.find((c) => c.correct)!;
    if (Math.abs(parsed.value - exprValue(correct.value)) > 1e-9) return;
    if (formError(parsed, correct.value, skill.acceptImproper, skill.allowUnreduced)) return;
    const t = window.setTimeout(() => submitInput(), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, reviewMode, phase, q, skill]);

  // 结束：积分入账（进阶模式全对翻倍）+ 学习日志（结算页一次性写入，避免中途刷新重复）
  const finalEarned = advanced ? earned * SCORE_RULES.advancedMultiplier : earned;
  const bankedRef = useRef(false);
  useEffect(() => {
    if ((phase === 'done' || phase === 'failed') && !bankedRef.current && skill) {
      bankedRef.current = true;
      const finalScore = phase === 'failed' ? 0 : finalEarned;
      if (finalScore !== 0) addPoints(finalScore);
      logSession({
        skillId: skill.id,
        skillTitle: skill.title,
        mode,
        correct: records.filter((r) => r.correct).length,
        total: records.length,
        earned: finalScore,
        durationSec: records.reduce((s, r) => s + r.timeUsedSec, 0),
      });
    }
  }, [phase, finalEarned]);

  useEffect(
    () => () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current);
    },
    [],
  );

  if (!skill || !q) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">知识点不存在</p>
      </div>
    );
  }

  const modeLabel = reviewMode ? '📝 复习' : advanced ? '⚡ 进阶' : '🎯 闯关';

  if (phase === 'done') {
    const correctCount = records.filter((r) => r.correct).length;
    const firstTryCount = records.filter((r) => r.correct && r.wrongAttempts === 0).length;
    const avgTime = records.length
      ? records.reduce((s, r) => s + r.timeUsedSec, 0) / records.length
      : 0;
    return (
      <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-6xl">{advanced ? '🏆' : '🎉'}</div>
        <h2 className="text-2xl font-bold">{advanced ? '全对通关，积分翻倍！' : '挑战完成！'}</h2>
        <div className="bg-white rounded-3xl shadow-lg p-6 w-full max-w-sm grid grid-cols-2 gap-4 text-center">
          <Stat
            label={advanced ? `获得积分（×${SCORE_RULES.advancedMultiplier}）` : '获得积分'}
            value={`${finalEarned >= 0 ? '+' : ''}${finalEarned}`}
            highlight
          />
          <Stat label="答对" value={`${correctCount}/${records.length}`} />
          <Stat label="一次就对" value={`${firstTryCount}/${records.length}`} />
          <Stat label="平均用时" value={`${avgTime.toFixed(1)}s`} />
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-200"
            onClick={() => window.location.reload()}
          >
            再来一局
          </button>
          <button
            className="flex-1 h-14 rounded-2xl bg-white border font-bold text-lg"
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // 进阶模式失败页：倒在第几题 + 正确答案 + 误区讲解 + 回闯关模式
  if (phase === 'failed') {
    const picked = q.choices.find((c) => c.id === pickedId);
    const correct = q.choices.find((c) => c.correct)!;
    return (
      <div className="min-h-dvh bg-gradient-to-b from-red-50 to-white flex flex-col items-center justify-center p-6 gap-6 text-center">
        <div className="text-6xl">💥</div>
        <h2 className="text-2xl font-bold">倒在了第 {index + 1} 题</h2>
        <p className="text-slate-500">进阶模式一错归零，本局不得分</p>
        <div className="bg-white rounded-3xl shadow-lg p-6 w-full max-w-sm space-y-3">
          <div className="text-slate-400 text-sm">正确答案</div>
          <div className="text-4xl font-black text-emerald-600">
            <MathView expr={correct.value} />
          </div>
          {picked?.trap && <p className="text-sm text-red-500">💡 {picked.trap}</p>}
          {pickedId === null && <p className="text-sm text-red-500">⏰ 超时也算错哦</p>}
        </div>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-200"
            onClick={() => navigate(`/quiz/${skill.id}`)}
          >
            回闯关模式练习
          </button>
          <button
            className="flex-1 h-14 rounded-2xl bg-white border font-bold text-lg"
            onClick={() => navigate('/')}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, (timeLeft / timeLimitSec) * 100); // +5s 补偿可能超出 100%，进度条截断
  const urgent = timeLeft <= 3;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* 顶栏：退出 / 进度 / 模式 / 连对 / 得分 */}
      <header className="flex items-center gap-3 p-4">
        <button onClick={() => navigate(`/skill/${skill.id}`)} className="p-2 -ml-2 rounded-full hover:bg-black/5">
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-slate-500">
          {index + 1} / {questions.length}
        </span>
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full ${
            reviewMode
              ? 'bg-emerald-100 text-emerald-600'
              : advanced
                ? 'bg-red-100 text-red-600'
                : 'bg-indigo-100 text-indigo-600'
          }`}
        >
          {modeLabel}
          {advanced && ` ×${SCORE_RULES.advancedMultiplier} · 一错归零`}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {streak >= 2 && (
            <span className="flex items-center gap-1 text-orange-500 font-bold">
              <Flame className="w-4 h-4" /> {streak} 连对
            </span>
          )}
          <span className="font-bold text-indigo-600">{earned} 分</span>
        </div>
      </header>

      {/* 倒数进度条（按秒） */}
      <div className="px-4">
        <Progress
          value={pct}
          className={`h-3 ${urgent ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-500'}`}
        />
        <div className={`text-right text-sm font-bold mt-1 ${urgent ? 'text-red-500' : 'text-slate-400'}`}>
          {Math.ceil(timeLeft)}s
        </div>
      </div>

      {/* 超大字题面（FitText 统一防溢出：任意项数等比缩放；随屏幕高度/宽度缩放，矮屏可滚动不裁切） */}
      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-4 gap-3 py-2">
        {q.requirement && <p className="text-slate-500 font-medium text-[clamp(0.8rem,2.2dvh,1rem)]">{q.requirement}</p>}
        <FitText className="text-[clamp(2.25rem,10dvh,4.5rem)] font-black tracking-tight text-slate-800 tabular-nums">
          <MathView expr={q.prompt} />
        </FitText>
        {!reviewMode && <p className="text-slate-400">= ?</p>}

        {/* 复习模式：填空显示框（右端 ✕ 一键清空） */}
        {reviewMode && (
          <div
            data-answer={(() => {
              const c = q.choices.find((x) => x.correct)!.value;
              return c.kind === 'frac' ? `${c.n}/${c.d}` : c.kind === 'mixed' ? `${c.whole} ${c.n}/${c.d}` : c.kind === 'text' ? c.text : '';
            })()}
            className={`relative mt-1 min-w-56 max-w-full px-6 h-[clamp(3rem,10dvh,6rem)] rounded-3xl border-4 flex items-center justify-center text-[clamp(1.75rem,7dvh,3.75rem)] font-black tabular-nums ${
              attempts > 0 ? 'border-red-300 bg-red-50 text-slate-800' : 'border-emerald-300 bg-white text-slate-800'
            }`}
          >
            <InputPreview s={input} />
            {input && phase === 'answering' && (
              <button
                data-key="clear"
                onClick={() => setInput('')}
                className="absolute -right-3 -top-3 w-9 h-9 rounded-full bg-slate-500 text-white text-base font-black shadow flex items-center justify-center active:scale-90"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* 即时反馈条（结算反馈 & 错选/填错反馈） */}
        {(phase === 'feedback' || attempts > 0) && lastBreakdown.length > 0 && (
          <div
            className={`mt-2 px-4 py-2 rounded-full font-bold text-sm ${
              lastDelta > 0 ? 'bg-emerald-100 text-emerald-700' : lastDelta < 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {lastBreakdown.join(' · ')}
          </div>
        )}
      </main>

      {/* 复习模式：数字键盘（按题库裁剪按键：numericKeypad 去掉分数线/带分数；✓ 占满最后一行剩余格） */}
      {reviewMode &&
        (() => {
          const extras: ReactElement[] = [];
          if (skill.allowNegative)
            extras.push(<KeyButton key="neg" onPress={() => pressKey('-')} label="−" sub="负号" keyId="-" />);
          if (!skill.numericKeypad) {
            if (!skill.hideMixedKey)
              extras.push(<KeyButton key="mixed" onPress={() => pressKey(' ')} label="1 ␣ ½" sub="带分数" small keyId=" " />);
            extras.push(<KeyButton key="frac" onPress={() => pressKey('/')} label="3/4" sub="分数线" keyId="/" />);
          }
          const submitSpan = extras.length === 3 ? 3 : 3 - extras.length;
          return (
            <footer className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] max-w-md mx-auto w-full">
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                  <KeyButton key={k} onPress={() => pressKey(k)} label={k} keyId={k} />
                ))}
                <KeyButton onPress={() => pressKey('0')} label="0" keyId="0" />
                <KeyButton onPress={() => pressKey('.')} label="." sub="小数点" keyId="." />
                <KeyButton onPress={() => pressKey('back')} label="⌫" icon keyId="back" />
                {extras}
                <button
                  data-key="submit"
                  onClick={submitInput}
                  style={{ gridColumn: `span ${submitSpan}` }}
                  className="h-[clamp(2.5rem,7dvh,4rem)] rounded-2xl bg-emerald-600 text-white text-[clamp(1.25rem,3.5dvh,1.5rem)] font-black shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  ✓
                </button>
              </div>
            </footer>
          );
        })()}

      {/* 闯关/进阶：固定 4 选项，错项置灰（高度随屏幕缩放） */}
      {!reviewMode && (
        <footer className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
          {q.choices.map((c) => {
            const slot = slotOf.get(c.id) ?? 0;
            const isWrongPicked = wrongIds.includes(c.id);
            let cls = 'bg-white border-2 border-slate-200 text-slate-800';
            if (phase === 'feedback') {
              if (c.correct) cls = 'bg-emerald-500 border-emerald-500 text-white';
              else if (isWrongPicked || c.id === pickedId) cls = 'bg-red-500 border-red-500 text-white';
              else cls = 'bg-white border-slate-200 text-slate-300';
            } else if (isWrongPicked) {
              cls = 'bg-slate-100 border-slate-200 text-slate-400';
            }
            return (
              <button
                key={c.id}
                style={{ order: slot }}
                data-correct={c.correct ? '1' : undefined}
                disabled={phase !== 'answering' || isWrongPicked}
                onClick={() => onChoice(c)}
                className={`h-[clamp(3.5rem,11dvh,5rem)] rounded-2xl text-[clamp(1.5rem,5dvh,2.25rem)] font-black shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center overflow-hidden px-1 ${cls}`}
              >
                <FitText>
                  <MathView expr={c.value} />
                </FitText>
                {isWrongPicked && c.trap && (
                  <span className="block text-xs font-medium mt-1 opacity-90">{c.trap}</span>
                )}
                {phase === 'feedback' && c.id === pickedId && !c.correct && c.trap && !isWrongPicked && (
                  <span className="block text-xs font-medium mt-1 opacity-90">{c.trap}</span>
                )}
              </button>
            );
          })}
        </footer>
      )}
    </div>
  );
}

function KeyButton({
  onPress,
  label,
  sub,
  icon,
  small,
  keyId,
}: {
  onPress: () => void;
  label: string;
  sub?: string;
  icon?: boolean;
  small?: boolean;
  keyId?: string;
}) {
  return (
    <button
      onClick={onPress}
      data-key={keyId}
      className="h-[clamp(2.5rem,7dvh,4rem)] rounded-2xl bg-white border-2 border-slate-200 shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center"
    >
      {icon ? <Delete className="w-[clamp(1.25rem,3.5dvh,1.75rem)] h-[clamp(1.25rem,3.5dvh,1.75rem)] text-slate-600" /> : (
        <span className={`font-black text-slate-800 ${small ? 'text-[clamp(0.9rem,2.8dvh,1.25rem)]' : 'text-[clamp(1.25rem,3.5dvh,1.875rem)]'}`}>{label}</span>
      )}
      {sub && <span className="text-[10px] text-slate-400 font-bold">{sub}</span>}
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4">
      <div className={`text-2xl font-black ${highlight ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}
