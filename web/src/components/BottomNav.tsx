import { useNavigate } from 'react-router';
import { BookOpen, Gamepad2, Settings2 } from 'lucide-react';

/** 底部三标签导航：学习 | 游戏厅 | 设置 */
export default function BottomNav({ active }: { active: 'learn' | 'games' | 'settings' }) {
  const navigate = useNavigate();
  const item = (
    key: 'learn' | 'games' | 'settings',
    label: string,
    icon: React.ReactNode,
    path: string,
  ) => (
    <button
      onClick={() => active !== key && navigate(path)}
      className={`flex-1 py-3 flex flex-col items-center gap-0.5 font-bold text-xs ${
        active === key ? 'text-indigo-600' : 'text-slate-400'
      }`}
    >
      {icon} {label}
    </button>
  );
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t flex">
      {item('learn', '学习', <BookOpen className="w-5 h-5" />, '/')}
      {item('games', '游戏厅', <Gamepad2 className="w-5 h-5" />, '/games')}
      {item('settings', '设置', <Settings2 className="w-5 h-5" />, '/settings')}
    </nav>
  );
}
