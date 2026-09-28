/**
 * 家长设置 —— 家长密码（4 位 PIN）+ 愿望激励配置。
 * 本地持久化（localStorage）。
 *
 * 愿望激励：家长设置目标分（1000 为单位）+ 愿望文本；
 * 孩子积分余额达到目标后可兑换，兑换时从余额扣掉目标分，
 * 兑换后配置作废，设置页提醒家长兑现并设置新愿望。
 */

export interface Wish {
  target: number; // 目标积分（1000 的倍数）
  text: string; // 愿望内容，如 "周末短途游"
}

export interface Settings {
  pin: string | null; // 家长密码（未设置 = null）
  wish: Wish | null; // 当前生效的愿望
  lastRedeemed: (Wish & { ts: number }) | null; // 最近一次已兑换的愿望（提醒家长兑现）
}

const KEY = 'shugan.settings.v1';
const EVT = 'shugan-settings-change';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch {
    /* ignore */
  }
  return { pin: null, wish: null, lastRedeemed: null };
}

function save(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export function getSettings(): Settings {
  return load();
}

/** 设置/修改家长密码 */
export function setPin(pin: string) {
  const s = load();
  s.pin = pin;
  save(s);
}

/** 校验家长密码 */
export function verifyPin(pin: string): boolean {
  return load().pin === pin;
}

/** 保存愿望配置 */
export function setWish(wish: Wish | null) {
  const s = load();
  s.wish = wish;
  save(s);
}

/** 孩子兑换愿望：记录到 lastRedeemed 并清空当前配置（积分扣减由调用方走钱包） */
export function redeemWish(): Wish | null {
  const s = load();
  if (!s.wish) return null;
  const w = s.wish;
  s.lastRedeemed = { ...w, ts: Date.now() };
  s.wish = null;
  save(s);
  return w;
}

/** 家长已读"已兑换"提醒 */
export function ackRedeemed() {
  const s = load();
  s.lastRedeemed = null;
  save(s);
}

import { useEffect, useState } from 'react';

/** React hook：订阅设置变化 */
export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(load);
  useEffect(() => {
    const on = () => setS(load());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return s;
}
