import { useNavigate, useParams } from 'react-router';
import { findSkill } from '@/data/bank';
import { useWallet } from '@/core/wallet';
import { modeParams } from '@/core/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, Target } from 'lucide-react';

/** 知识点引导页：说明考核内容 + 三模式入口（复习填空 / 闯关选择 / 进阶考场） */
export default function QuizIntro() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const wallet = useWallet();
  const skill = skillId ? findSkill(skillId) : undefined;

  if (!skill) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">知识点不存在</p>
        <Button className="mt-4" onClick={() => navigate('/')}>返回首页</Button>
      </div>
    );
  }

  const review = modeParams(skill, 'review');
  const normal = modeParams(skill, 'normal');
  const advanced = modeParams(skill, 'advanced');
  const canReview = skill.supportsReview !== false;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      <header className="flex items-center gap-3 p-4">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-black/5">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">{skill.title}</h1>
        <div className="ml-auto flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
          <Zap className="w-4 h-4" /> {wallet.points}
        </div>
      </header>

      <main className="flex-1 px-6 flex flex-col justify-center gap-5 max-w-md mx-auto w-full pb-8">
        <div className="bg-white rounded-3xl shadow-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Target className="w-5 h-5" /> 考前必读
          </div>
          <ul className="space-y-3">
            {skill.intro.map((line, i) => (
              <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-slate-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* 三模式入口 */}
        <div className="space-y-3">
          {canReview && (
            <>
              <Button
                size="lg"
                className="w-full h-16 text-xl font-bold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                onClick={() => navigate(`/quiz/${skill.id}?mode=review`)}
              >
                📝 复习模式 · 填空
              </Button>
              <p className="text-xs text-slate-400 text-center -mt-1">
                {review.count} 题 · 每题 {review.timeLimitSec} 秒 · 自己填答案，填错提示原因可重填
              </p>
            </>
          )}
          <Button
            size="lg"
            className="w-full h-16 text-xl font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            onClick={() => navigate(`/quiz/${skill.id}`)}
          >
            🎯 闯关模式 · 选择
          </Button>
          <p className="text-xs text-slate-400 text-center -mt-1">
            {normal.count} 题 · 每题 {normal.timeLimitSec} 秒 · 4 个选项，答错扣分但可以继续
          </p>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-16 text-xl font-bold rounded-2xl border-2 border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => navigate(`/quiz/${skill.id}?mode=advanced`)}
          >
            ⚡ 进阶模式 · 全对翻倍
          </Button>
          <p className="text-xs text-slate-400 text-center -mt-1">
            {advanced.count} 题 · 每题 {advanced.timeLimitSec} 秒 · 全对积分 ×2，错一题或超时本局归零
          </p>
        </div>
      </main>
    </div>
  );
}
