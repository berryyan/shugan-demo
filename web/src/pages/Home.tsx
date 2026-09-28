import { useNavigate } from 'react-router';
import { GRADES } from '@/data/bank';
import { useWallet } from '@/core/wallet';
import BottomNav from '@/components/BottomNav';
import WishBanner from '@/components/WishBanner';
import { Zap, ChevronRight, Lock, BookOpen } from 'lucide-react';

/** 首页：分年级分单元浏览知识点 + 积分钱包入口 */
export default function Home() {
  const navigate = useNavigate();
  const wallet = useWallet();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white pb-24">
      <header className="p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">数学不再难</h1>
          <p className="text-sm text-slate-400 mt-0.5">快问快答 · 练出数感</p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-4 py-2 rounded-full font-black text-lg">
          <Zap className="w-5 h-5" /> {wallet.points}
        </div>
      </header>

      <main className="px-4 space-y-6 max-w-md mx-auto">
        <WishBanner />
        {GRADES.map((grade) => (
          <section key={grade.id}>
            <h2 className="font-bold text-slate-600 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> {grade.title}
              {!grade.available && (
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  即将上线
                </span>
              )}
            </h2>
            <div className="space-y-3">
              {grade.units.map((unit) => (
                <div key={unit.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 text-sm font-bold text-slate-500">
                    {unit.title}
                  </div>
                  {unit.skills.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-300 flex items-center gap-2">
                      <Lock className="w-4 h-4" /> 内容筹备中
                    </div>
                  ) : (
                    unit.skills.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/skill/${s.id}`)}
                        className="w-full flex items-center px-4 py-4 hover:bg-indigo-50/50 active:bg-indigo-50 transition-colors"
                      >
                        <div className="text-left">
                          <div className="font-bold text-slate-800">{s.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {s.questionCount} 题 · 每题 {s.timeLimitSec} 秒
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 ml-auto" />
                      </button>
                    ))
                  )}
                </div>
              ))}
              {grade.units.length === 0 && (
                <div className="bg-white/60 rounded-2xl px-4 py-6 text-center text-sm text-slate-300">
                  <Lock className="w-5 h-5 mx-auto mb-1" /> 敬请期待
                </div>
              )}
            </div>
          </section>
        ))}
      </main>

      {/* 底部导航 */}
      <BottomNav active="learn" />
    </div>
  );
}
