import { useState } from 'react';
import { Gift, X } from 'lucide-react';
import { useWallet, addPoints } from '@/core/wallet';
import { useSettings, redeemWish } from '@/core/settings';

/**
 * 愿望激励条（孩子侧）：家长设置了愿望后显示在学习页/游戏厅顶部。
 * 未达标：进度条"还差 N 分"；达标：金色可点，点击弹窗确认兑换（扣除目标分，愿望作废）。
 */
export default function WishBanner() {
  const wallet = useWallet();
  const settings = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [justRedeemed, setJustRedeemed] = useState<string | null>(null);

  const wish = settings.wish;
  if (!wish && !justRedeemed) return null;

  // 兑换成功提示
  if (justRedeemed) {
    return (
      <div className="mx-4 mb-3 max-w-md sm:mx-auto bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center">
        <div className="text-3xl mb-1">🎉</div>
        <p className="font-black text-emerald-700">已兑换「{justRedeemed}」</p>
        <p className="text-sm text-emerald-600 mt-1">快去找家长兑现吧！</p>
        <button
          onClick={() => setJustRedeemed(null)}
          className="mt-3 px-6 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm"
        >
          好的
        </button>
      </div>
    );
  }

  if (!wish) return null;
  const reached = wallet.points >= wish.target;
  const pct = Math.min(100, Math.round((wallet.points / wish.target) * 100));

  return (
    <>
      <button
        onClick={() => reached && setConfirming(true)}
        className={`mx-4 mb-3 max-w-md sm:mx-auto block w-[calc(100%-2rem)] sm:w-full rounded-2xl p-3.5 text-left border-2 transition-all ${
          reached
            ? 'bg-amber-50 border-amber-400 shadow-lg shadow-amber-100 active:scale-[0.98]'
            : 'bg-white border-amber-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Gift className={`w-5 h-5 ${reached ? 'text-amber-500' : 'text-amber-400'}`} />
          <span className="font-bold text-slate-700 text-sm flex-1 truncate">
            愿望：{wish.text}
          </span>
          <span className={`text-sm font-black ${reached ? 'text-amber-600' : 'text-slate-400'}`}>
            {reached ? '点我兑换 🎁' : `还差 ${wish.target - wallet.points} 分`}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-amber-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${reached ? 'bg-amber-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {/* 兑换确认弹窗 */}
      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-4xl mb-2">🎁</div>
            <h3 className="text-lg font-black text-slate-800">兑换愿望？</h3>
            <p className="text-slate-500 text-sm mt-2">
              「{wish.text}」将扣除 {wish.target} 积分，
              <br />
              兑换后记得找家长兑现哦！
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 h-12 rounded-2xl bg-slate-100 font-bold text-slate-500 flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" /> 再想想
              </button>
              <button
                onClick={() => {
                  addPoints(-wish.target);
                  const w = redeemWish();
                  setConfirming(false);
                  if (w) setJustRedeemed(w.text);
                }}
                className="flex-1 h-12 rounded-2xl bg-amber-500 text-white font-bold"
              >
                确认兑换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
