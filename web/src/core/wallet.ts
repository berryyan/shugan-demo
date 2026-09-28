/**
 * 积分钱包 —— 快问快答赚取积分，小游戏消耗积分。
 * 本地持久化（localStorage），跨页面通过自定义事件同步。
 */

export interface Wallet {
  points: number;
  totalEarned: number;
  totalSpent: number;
}

const KEY = 'shugan.wallet.v1';
const EVT = 'shugan-wallet-change';

function load(): Wallet {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Wallet;
  } catch {
    /* ignore */
  }
  return { points: 0, totalEarned: 0, totalSpent: 0 };
}

function save(w: Wallet) {
  localStorage.setItem(KEY, JSON.stringify(w));
  window.dispatchEvent(new Event(EVT));
}

export function getWallet(): Wallet {
  return load();
}

/** 加积分（负数也会先扣到 0 为止，积分不为负） */
export function addPoints(delta: number): Wallet {
  const w = load();
  w.points = Math.max(0, w.points + delta);
  if (delta > 0) w.totalEarned += delta;
  save(w);
  return w;
}

/** 消耗积分；余额不足返回 null */
export function spendPoints(amount: number): Wallet | null {
  const w = load();
  if (w.points < amount) return null;
  w.points -= amount;
  w.totalSpent += amount;
  save(w);
  return w;
}

/** 重置分数（家长在设置页手动操作）：积分全部清零，游戏记录不受影响 */
export function resetWallet() {
  save({ points: 0, totalEarned: 0, totalSpent: 0 });
}

/** React hook：订阅钱包变化 */
import { useEffect, useState } from 'react';

export function useWallet(): Wallet {
  const [w, setW] = useState<Wallet>(load);
  useEffect(() => {
    const on = () => setW(load());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return w;
}
