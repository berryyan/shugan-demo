const { HGE2_TIERS, stageLocked, tierLockedReason } = require('./hge2.js');

/**
 * 小游戏注册表（小程序版）—— 新游戏在这里登记元信息，游戏厅自动展示。
 * 与网页版 registry.ts 保持一致：HGE2 复刻档排在最前。
 */

const MINI_GAMES = [
  ...HGE2_TIERS.map((t, i) => ({
    id: t.id,
    title: t.title,
    icon: t.icon,
    ability: t.ability,
    entryFee: t.entryFee,
    description: t.description,
    scoreLabel: '等级分',
    page: `/pages/hge2/hge2?tierId=${t.id}`,
    levels: t.stages.map((s) => ({
      title: `${s.num} ${s.name}`,
      hint: s.disabled || (s.mechanic ? s.rules[0] : '即将上线'),
    })),
    _tier: t,
    _tierIndex: i,
  })),
  {
    id: 'memory-flash',
    title: '数字闪现',
    icon: '🧠',
    ability: '记忆力',
    entryFee: 15,
    description: '数字一闪而过，凭记忆按顺序复现。6 关逐级加速！',
    scoreLabel: '等级分',
    page: '/pages/mflash/mflash',
    levels: [
      { title: '第 1 关', hint: '4 位数字 · 展示 1.8 秒', len: 4, showMs: 1800, t: [2500, 3200, 4000, 5000, 6500, 8000] },
      { title: '第 2 关', hint: '5 位数字 · 展示 2.1 秒', len: 5, showMs: 2100, t: [3000, 3800, 4700, 5800, 7500, 9500] },
      { title: '第 3 关', hint: '6 位数字 · 展示 2.4 秒', len: 6, showMs: 2400, t: [3500, 4500, 5500, 7000, 9000, 11000] },
      { title: '第 4 关', hint: '6 位数字 · 展示 1.8 秒', len: 6, showMs: 1800, t: [3500, 4500, 5500, 7000, 9000, 11000] },
      { title: '第 5 关', hint: '6 位数字 · 展示 1.2 秒', len: 6, showMs: 1200, t: [3500, 4500, 5500, 7000, 9000, 11000] },
      { title: '第 6 关', hint: '6 位数字 · 只闪 0.8 秒！', len: 6, showMs: 800, t: [3500, 4500, 5500, 7000, 9000, 11000] },
    ],
  },
  {
    id: 'reaction-tap',
    title: '极速点击',
    icon: '⚡',
    ability: '反应力',
    entryFee: 15,
    description: '变绿瞬间立刻点击！后面关卡会出现假信号，稳住别被骗。',
    scoreLabel: '等级分',
    page: '/pages/rtap/rtap',
    levels: [
      { title: '第 1 关', hint: '3 次平均反应 · 标准节奏' },
      { title: '第 2 关', hint: '3 次平均反应 · 更快拿 S' },
      { title: '第 3 关', hint: '等待时间更飘忽' },
      { title: '第 4 关', hint: '等待时间极飘忽' },
      { title: '第 5 关', hint: '加入假信号：黄光不能点！' },
      { title: '第 6 关', hint: '假信号 + 最严评级' },
    ],
  },
  {
    id: 'match-pairs',
    title: '等值扑克',
    icon: '🃏',
    ability: '反应力',
    entryFee: 15,
    description: '每张牌是同一个数的不同写法（½、0.5、50%、2/4），60 秒内找出等值的一对！',
    scoreLabel: '对数',
    page: '/pages/mpairs/mpairs',
    levels: [
      { title: '第 1 关', hint: '4 张牌 · 分数与小数' },
      { title: '第 2 关', hint: '4 张牌 · 加入未约分形态（2/4）' },
      { title: '第 3 关', hint: '4 张牌 · 加入百分数（50%）' },
      { title: '第 4 关', hint: '6 张牌 · 眼花缭乱' },
      { title: '第 5 关', hint: '6 张牌 · 加入带分数/假分数' },
      { title: '第 6 关', hint: '6 张牌 · 大师级评级线' },
    ],
  },
  {
    id: 'bigger-tap',
    title: '谁更大',
    icon: '⚖️',
    ability: '反应力',
    entryFee: 15,
    description: '两个分数/小数快闪，以最快速度点更大的那一边！',
    scoreLabel: '等级分',
    page: '/pages/bigger/bigger',
    levels: [
      { title: '第 1 关', hint: '10 题 · 常考分母' },
      { title: '第 2 关', hint: '10 题 · 半数换成小数' },
      { title: '第 3 关', hint: '12 题 · 分母加入 3' },
      { title: '第 4 关', hint: '12 题 · 差距更小' },
      { title: '第 5 关', hint: '15 题 · 差值 0.04 起' },
      { title: '第 6 关', hint: '15 题 · 大师级，差值 0.03 起' },
    ],
  },
];

function findGame(gameId) {
  return MINI_GAMES.find((g) => g.id === gameId);
}

module.exports = { MINI_GAMES, findGame, stageLocked, tierLockedReason };
