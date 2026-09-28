import { useState } from 'react';
import {
  setPin,
  verifyPin,
  setWish,
  ackRedeemed,
  useSettings,
} from '@/core/settings';
import { getDayLog, daySummary } from '@/core/studyLog';
import { resetWallet, useWallet } from '@/core/wallet';
import BottomNav from '@/components/BottomNav';
import { Lock, Gift, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react';

const MODE_LABEL = { review: '📝 复习', normal: '🎯 闯关', advanced: '⚡ 进阶' } as const;

/** 设置页（家长）：4 位 PIN 门禁 → 当日学习记录 / 积分激励（愿望）/ 重置分数 */
export default function SettingsPage() {
  const settings = useSettings();
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white pb-24">
      <header className="p-5">
        <h1 className="text-2xl font-black text-slate-800">设置</h1>
        <p className="text-sm text-slate-400 mt-0.5">家长专用</p>
      </header>

      {!unlocked ? (
        <PinGate hasPin={!!settings.pin} onUnlock={() => setUnlocked(true)} />
      ) : (
        <SettingsBody />
      )}

      <BottomNav active="settings" />
    </div>
  );
}

/* ---------------- 家长密码门禁 ---------------- */

function PinGate({ hasPin, onUnlock }: { hasPin: boolean; onUnlock: () => void }) {
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null); // 首次设置时的二次确认
  const [error, setError] = useState('');

  const submit = () => {
    if (!/^\d{4}$/.test(pin)) {
      setError('请输入 4 位数字');
      return;
    }
    if (!hasPin) {
      // 首次设置：二次确认
      if (confirm === null) {
        setConfirm(pin);
        setPinInput('');
        setError('');
        return;
      }
      if (confirm !== pin) {
        setError('两次输入不一致，请重新设置');
        setConfirm(null);
        setPinInput('');
        return;
      }
      setPin(pin);
      onUnlock();
      return;
    }
    if (verifyPin(pin)) onUnlock();
    else {
      setError('密码不对');
      setPinInput('');
    }
  };

  return (
    <main className="px-6 max-w-sm mx-auto mt-10">
      <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
        <Lock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <h2 className="font-black text-lg text-slate-800">
          {hasPin ? '输入家长密码' : confirm !== null ? '再输一次确认' : '设置家长密码'}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {hasPin ? '4 位数字' : '4 位数字，防止孩子改设置'}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="mt-4 w-full h-14 text-center text-3xl font-black tracking-[0.5em] rounded-2xl border-2 border-slate-200 focus:border-indigo-400 outline-none"
          placeholder="····"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm font-bold mt-2">{error}</p>}
        <button
          onClick={submit}
          className="mt-4 w-full h-12 rounded-2xl bg-indigo-600 text-white font-bold"
        >
          {hasPin ? '解锁' : confirm !== null ? '确认' : '下一步'}
        </button>
      </div>
    </main>
  );
}

/* ---------------- 设置内容 ---------------- */

function SettingsBody() {
  const settings = useSettings();
  const wallet = useWallet();
  const [pinMsg, setPinMsg] = useState('');

  // 愿望表单
  const [target, setTarget] = useState(2000);
  const [wishText, setWishText] = useState('');
  const [wishMsg, setWishMsg] = useState('');

  // 重置分数确认
  const [resetArmed, setResetArmed] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const log = getDayLog();
  const sum = daySummary();

  const saveWish = () => {
    if (!wishText.trim()) {
      setWishMsg('请填写愿望内容');
      return;
    }
    setWish({ target, text: wishText.trim() });
    setWishText('');
    setWishMsg('已保存 ✓');
    setTimeout(() => setWishMsg(''), 2000);
  };

  return (
    <main className="px-4 space-y-5 max-w-md mx-auto">
      {/* 已兑换提醒 */}
      {settings.lastRedeemed && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-emerald-700 text-sm">
                愿望「{settings.lastRedeemed.text}」（{settings.lastRedeemed.target} 分）已于{' '}
                {new Date(settings.lastRedeemed.ts).toLocaleDateString('zh-CN')} 兑换
              </p>
              <p className="text-xs text-emerald-600 mt-1">记得兑现承诺，并在下方设置新愿望！</p>
            </div>
            <button
              onClick={ackRedeemed}
              className="text-xs font-bold text-emerald-600 bg-white rounded-lg px-2 py-1 border border-emerald-200"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* 当日学习记录 */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 text-sm font-bold text-slate-500">
          当日学习记录
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <Stat label="局数" value={String(sum.sessions)} />
            <Stat label="答题" value={`${sum.correctQ}/${sum.totalQ}`} />
            <Stat label="正确率" value={`${sum.accuracy}%`} />
            <Stat label="积分" value={`${sum.earned >= 0 ? '+' : ''}${sum.earned}`} />
          </div>
          {log.length === 0 ? (
            <p className="text-sm text-slate-300 text-center py-3">今天还没有学习记录</p>
          ) : (
            <ol className="space-y-2">
              {log.map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-300 tabular-nums">
                    {new Date(e.ts).toTimeString().slice(0, 5)}
                  </span>
                  <span className="font-bold text-slate-700 truncate">{e.skillTitle}</span>
                  <span className="text-xs">{MODE_LABEL[e.mode]}</span>
                  <span className="ml-auto text-slate-500">
                    {e.correct}/{e.total} 题
                  </span>
                  <span className={`font-bold w-12 text-right ${e.earned >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                    {e.earned >= 0 ? '+' : ''}{e.earned}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* 积分激励（愿望） */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 text-sm font-bold text-slate-500 flex items-center gap-1.5">
          <Gift className="w-4 h-4 text-amber-500" /> 积分激励（愿望兑换）
        </div>
        <div className="p-4 space-y-3">
          {settings.wish ? (
            <div className="bg-amber-50 rounded-xl p-3 text-sm">
              <p className="font-bold text-amber-700">
                进行中：{settings.wish.target} 分 → 「{settings.wish.text}」
              </p>
              <p className="text-xs text-amber-600 mt-1">
                孩子当前 {wallet.points} 分（{Math.min(100, Math.round((wallet.points / settings.wish.target) * 100))}%）
              </p>
              <button
                onClick={() => setWish(null)}
                className="mt-2 text-xs font-bold text-red-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> 删除这个愿望
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 shrink-0">目标分</span>
                <select
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="flex-1 h-11 rounded-xl border-2 border-slate-200 px-3 font-bold text-slate-700"
                >
                  {[1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000].map((v) => (
                    <option key={v} value={v}>{v} 分</option>
                  ))}
                </select>
              </div>
              <input
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                maxLength={20}
                placeholder="愿望内容，如：奖励零用钱 5 元"
                className="w-full h-11 rounded-xl border-2 border-slate-200 px-3 font-bold text-slate-700 outline-none focus:border-amber-400"
              />
              <button
                onClick={saveWish}
                className="w-full h-11 rounded-xl bg-amber-500 text-white font-bold"
              >
                保存愿望
              </button>
              {wishMsg && <p className="text-sm font-bold text-amber-600 text-center">{wishMsg}</p>}
              <p className="text-xs text-slate-400">
                孩子积分达到目标后可自行点击兑换（扣除目标分），兑换后这里会提醒你兑现并设置新愿望。
              </p>
            </>
          )}
        </div>
      </section>

      {/* 家长密码修改 */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 text-sm font-bold text-slate-500">家长密码</div>
        <div className="p-4">
          <ChangePin onDone={(msg) => { setPinMsg(msg); setTimeout(() => setPinMsg(''), 2000); }} />
          {pinMsg && <p className="text-sm font-bold text-indigo-600 text-center mt-2">{pinMsg}</p>}
        </div>
      </section>

      {/* 重置分数（红色，放最后） */}
      <section className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 border-red-100">
        <div className="p-4">
          {!resetArmed ? (
            <button
              onClick={() => setResetArmed(true)}
              className="w-full h-12 rounded-xl bg-red-600 text-white font-black flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> 重置分数
            </button>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm font-bold text-red-600">
                确定清零？积分余额和学习记录将全部清空（游戏记录保留）
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setResetArmed(false)}
                  className="flex-1 h-11 rounded-xl bg-slate-100 font-bold text-slate-500"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    resetWallet();
                    import('@/core/studyLog').then((m) => m.clearStudyLog());
                    setResetArmed(false);
                    setResetDone(true);
                    setTimeout(() => setResetDone(false), 2500);
                  }}
                  className="flex-1 h-11 rounded-xl bg-red-600 text-white font-black"
                >
                  确认清零
                </button>
              </div>
            </div>
          )}
          {resetDone && <p className="text-sm font-bold text-red-500 text-center mt-2">已清零 ✓</p>}
          <p className="text-xs text-slate-400 mt-2 text-center">调试用：积分与学习记录清零，游戏排行榜和关卡记录不受影响</p>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5">
      <div className="text-lg font-black text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

/** 修改密码：旧密码 → 新密码两次 */
function ChangePin({ onDone }: { onDone: (msg: string) => void }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [step, setStep] = useState<'old' | 'new'>('old');

  const submit = () => {
    if (step === 'old') {
      if (!verifyPin(oldPin)) {
        onDone('原密码不对');
        setOldPin('');
        return;
      }
      setStep('new');
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      onDone('新密码需要 4 位数字');
      return;
    }
    setPin(newPin);
    setStep('old');
    setOldPin('');
    setNewPin('');
    onDone('密码已修改 ✓');
  };

  return (
    <div className="flex gap-2">
      {step === 'old' ? (
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
          placeholder="原密码"
          className="flex-1 h-11 rounded-xl border-2 border-slate-200 px-3 font-bold text-center outline-none focus:border-indigo-400"
        />
      ) : (
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="新密码（4 位数字）"
          className="flex-1 h-11 rounded-xl border-2 border-slate-200 px-3 font-bold text-center outline-none focus:border-indigo-400"
        />
      )}
      <button onClick={submit} className="h-11 px-5 rounded-xl bg-indigo-600 text-white font-bold shrink-0">
        {step === 'old' ? '下一步' : '确认修改'}
      </button>
    </div>
  );
}
