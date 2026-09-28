import { useNavigate } from 'react-router';
import { MINI_GAMES } from '@/games/registry';
import { getLeaderboard } from '@/core/leaderboard';
import { getProgress, GRADE_STYLE } from '@/games/levels';
import { useWallet } from '@/core/wallet';
import BottomNav from '@/components/BottomNav';
import WishBanner from '@/components/WishBanner';
import { Zap, Trophy, ArrowLeft } from 'lucide-react';

/** 游戏厅：消耗积分入场，每个游戏带本地排行榜 */
export default function GamesHall() {
  const navigate = useNavigate();
  const wallet = useWallet();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white pb-24">
      <header className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-black/5">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-black text-slate-800">游戏厅</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-4 py-2 rounded-full font-black text-lg">
          <Zap className="w-5 h-5" /> {wallet.points}
        </div>
      </header>

      <main className="px-4 space-y-4 max-w-md mx-auto">
        <WishBanner />
        <p className="text-sm text-slate-400">消耗积分入场，练专注力 / 记忆力 / 反应力，冲击排行榜！</p>
        {MINI_GAMES.map((g) => {
          const board = getLeaderboard(g.id);
          const affordable = wallet.points >= g.entryFee;
          const lockReason = g.gameLocked?.() ?? null;
          return (
            <div key={g.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <button
                onClick={() => !lockReason && navigate(g.id.startsWith('hge2-') ? `/games/hge2/${g.id}` : `/games/${g.id}`)}
                className="w-full text-left p-5 active:bg-violet-50/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{g.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-slate-800">{g.title}</span>
                      <span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">
                        {g.ability}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{g.description}</p>
                  </div>
                </div>
                <div className={`mt-3 text-center py-2.5 rounded-xl font-bold ${
                  lockReason
                    ? 'bg-slate-100 text-slate-400'
                    : affordable
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                }`}>
                  {lockReason ?? (affordable ? `入场 ${g.entryFee} 积分` : `积分不足（需 ${g.entryFee}）`)}
                </div>
                {/* 关卡进度：6 关评级圆点 */}
                <div className="mt-3 flex items-center gap-1.5">
                  {g.levels.map((lv, i) => {
                    const prog = getProgress(g.id);
                    const grade = prog.grades[String(i)];
                    const locked = g.levelLocked
                      ? g.levelLocked(prog.grades, i)
                      : i > prog.unlocked;
                    return (
                      <span
                        key={i}
                        title={lv.hint}
                        className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                          grade
                            ? GRADE_STYLE[grade]
                            : locked
                              ? 'bg-slate-100 text-slate-300'
                              : 'bg-violet-100 text-violet-400'
                        }`}
                      >
                        {grade ?? (locked ? '·' : i + 1)}
                      </span>
                    );
                  })}
                  <span className="ml-auto text-xs text-slate-400">
                    S 总数 {Object.values(getProgress(g.id).grades).filter((x) => x === 'S').length}/6
                  </span>
                </div>
              </button>

              {/* 排行榜 */}
              <div className="border-t px-5 py-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> 排行榜（{g.scoreLabel}）
                </div>
                {board.length === 0 ? (
                  <p className="text-xs text-slate-300">虚位以待，来当第一名！</p>
                ) : (
                  <ol className="space-y-1">
                    {board.slice(0, 5).map((e, i) => (
                      <li key={i} className="flex items-center text-sm">
                        <span className={`w-6 font-black ${i === 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                          {i + 1}
                        </span>
                        <span className="text-slate-600">{e.name}</span>
                        <span className="ml-auto font-bold text-slate-800">{e.score}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <BottomNav active="games" />
    </div>
  );
}
