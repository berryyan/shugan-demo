/**
 * HGE2 复刻：24 关配置（4 难度档 × 6 关）—— 与网页版 stages.ts 一致。
 * fmt 改为字符串 key，展示时在页面层格式化。
 */
const { getProgress } = require('./levels.js');

const FMT = {
  ms: (m) => `${(m / 1000).toFixed(2)} 秒`,
  sec: (m) => `${m.toFixed(1)} 秒`,
  times: (m) => `${m} 次`,
  pts: (m) => `${m} 分`,
  f2s: (m) => `${m.toFixed(2)} 秒`,
  msInt: (m) => `${Math.round(m)} ms`,
};

const HGE2_TIERS = [
  {
    id: 'hge2-easy', title: '极限挑战 · 简单篇', icon: '🎪', ability: '反应力', entryFee: 15,
    description: 'HGE2 原版复刻 1-6 关：拼手速、拼反应，达 E 解锁下一关！',
    theme: { label: 'EASY', color: '#FFA726', dark: '#8a4500' },
    stages: [
      { num: 1, name: '不要挠我', icon: '🦶', mechanic: 'tickle',
        rules: ['脚丫出现在哪条颜色赛道，就点哪根同色羽毛挠它', '点错不扣分——三根手指一起挠是高手秘诀', '7 秒内挠的次数越多评级越高！'],
        higherBetter: true, t: [25, 24, 23, 22, 21, 20], fmt: 'times', metricName: '点击次数' },
      { num: 2, name: '石头剪刀布', icon: '✊', mechanic: 'rps',
        rules: ['判断左边赢、右边赢还是平局，共 20 局', '判对按速度得 1-6 分，判错扣 3 分', '总分 15 分过关，30 分拿 S！'],
        higherBetter: true, t: [30, 27, 24, 21, 18, 15], fmt: 'pts', metricName: '总分' },
      { num: 3, name: '瞌睡男孩', icon: '😴',
        rules: ['男孩的头会不停歪倒', '头往哪边倒，就点反方向的按钮扶正', '坚持越久评级越高！'],
        higherBetter: true, t: [10, 8.5, 7.5, 6.5, 5.8, 5], fmt: 'sec', metricName: '坚持时间' },
      { num: 4, name: '冲向厕所', icon: '🚽',
        rules: ['交替点击左右脚冲上楼梯间的厕所', '每次台阶数都不一样，点多了直接栽进马桶！', '连续冲 8 次，取平均用时'],
        higherBetter: false, t: [1500, 1700, 1900, 2100, 2300, 2500], fmt: 'ms', metricName: '总用时' },
      { num: 5, name: '狂热冰淇淋', icon: '🍦',
        rules: ['每个筒上标了需要几勺冰淇淋', '点筒加勺，正好点满才算完成', '点多了就失败——连续填满 14 筒！'],
        higherBetter: false, t: [12000, 13500, 15000, 16500, 18000, 20000], fmt: 'ms', metricName: '总用时' },
      { num: 6, name: '多次掌掴', icon: '👋',
        rules: ['恰好打 37 下，一下不能多也不能少', '计数器只显示前 10 下，之后靠自己默数', '数够了立刻按「停」！'],
        higherBetter: false, t: [5000, 6000, 7000, 8000, 9000, 10000], fmt: 'ms', metricName: '总用时' },
    ],
  },
  {
    id: 'hge2-normal', title: '极限挑战 · 普通篇', icon: '🔥', ability: '反应力', entryFee: 15,
    description: 'HGE2 原版复刻 7-12 关：手眼并用，一心二用！',
    theme: { label: 'NORMAL', color: '#EF5350', dark: '#7f1d1d' },
    stages: [
      { num: 7, name: '牛仔酒吧射击', icon: '🥃',
        rules: ['玻璃杯在哪个位置出现，就点对应的按钮击碎它', '点空就是浪费子弹，直接失败', '以最快速度清空 12 个杯子！'],
        higherBetter: false, t: [15000, 16000, 17000, 18000, 19000, 20000], fmt: 'ms', metricName: '总用时' },
      { num: 8, name: '展场女郎', icon: '📸',
        rules: ['女郎出现时狂点她下方的拍照按钮，拍一张得 2 分', '拍到机器人或保安直接出局', '15 秒内冲击高分，最后一波一定是 3 个女郎！'],
        higherBetter: true, t: [150, 144, 138, 132, 126, 120], fmt: 'pts', metricName: '得分' },
      { num: 9, name: '炸弹恐慌', icon: '💣',
        rules: ['3 个炸弹同时倒计时，速度各不相同', '点炸弹拆弹，剩余时间越接近 0.00 越好', '任何一个炸了就失败，共 2 轮！'],
        higherBetter: false, t: [0.2, 0.25, 0.3, 0.35, 0.4, 0.5], fmt: 'f2s', metricName: '平均剩余' },
      { num: 10, name: '疯狂摇奖', icon: '🎰',
        rules: ['按轮盘要求点击：颜色 × 次数', '「不是红色」= 点除红色外任意颜色', '点错颜色直接失败，共 4 轮！'],
        higherBetter: false, t: [8000, 8400, 8800, 9200, 9600, 10000], fmt: 'ms', metricName: '总用时' },
      { num: 11, name: '我喜欢数学', icon: '➕',
        rules: ['个位数加减法，但有一个数字被 ✋ 盖住了', '✋ 盖住的数字 = 上一题同一个位置的数字，靠瞬间记忆', '答错直接失败，共 8 题！'],
        higherBetter: false, t: [1000, 1100, 1200, 1300, 1400, 1500], fmt: 'msInt', metricName: '平均每题' },
      { num: 12, name: '三个小厨师', icon: '👨‍🍳',
        rules: ['鸡蛋从三根管子落下，落到蓝线瞬间点对应按钮接住', '越接近蓝线得分越高（满分 10 分/个）', '蛋砸到厨师头上就失败，共 20 个蛋！'],
        higherBetter: true, t: [170, 166, 162, 158, 154, 150], fmt: 'pts', metricName: '得分' },
    ],
  },
  {
    id: 'hge2-hard', title: '极限挑战 · 困难篇', icon: '💀', ability: '专注力', entryFee: 15,
    description: 'HGE2 原版复刻 13-18 关：眼疾手快，差之毫厘！',
    theme: { label: 'HARD', color: '#AB47BC', dark: '#4a1160' },
    stages: [
      { num: 13, name: '猜猜我是谁', icon: '🎭',
        rules: ['双手张开的一瞬间，看清走过去的是谁', '黑发=爸爸，红发=孩子，灰发=妈妈', '点对应按钮，可能同时走过多人，点错失败！'],
        higherBetter: false, t: [1000, 1050, 1100, 1150, 1180, 1200], fmt: 'msInt', metricName: '平均每轮' },
      { num: 14, name: '狗和骨头', icon: '🐶',
        rules: ['倾斜设备保持平衡（原版玩法）'], disabled: '需要陀螺仪体感，暂未开放',
        higherBetter: true, t: [40, 35, 30, 27, 23, 20], fmt: 'sec', metricName: '坚持时间' },
      { num: 15, name: '蹦蹦跳', icon: '🪨',
        rules: ['踩着石头过河：下一块石头什么颜色，就点什么颜色的按钮', '点错就掉河里，共 15 块石头！'],
        higherBetter: false, t: [8000, 8400, 8800, 9200, 9600, 10000], fmt: 'ms', metricName: '总用时' },
      { num: 16, name: '引体向上', icon: '💪',
        rules: ['左右交替狂点做引体向上', '15 秒内做得越多评级越高', '连续点同一边不算数！'],
        higherBetter: true, t: [90, 84, 78, 74, 72, 70], fmt: 'times', metricName: '完成次数' },
      { num: 17, name: '拔鼻毛', icon: '👃',
        rules: ['力量槽来回摆动，进入红色区域瞬间点「拔」', '越靠近红区中心得分越高', '没进红区就拔 = 失败，共 6 根！'],
        higherBetter: true, t: [600, 580, 560, 540, 520, 500], fmt: 'pts', metricName: '得分' },
      { num: 18, name: '相同数学扑克', icon: '🂡',
        rules: ['4 张牌里只有两张数字相同，快速把它们都点中', '没有相同牌时千万别点，等下一组', '点错失败，共 8 组！'],
        higherBetter: false, t: [400, 500, 600, 700, 750, 800], fmt: 'msInt', metricName: '平均每组' },
    ],
  },
  {
    id: 'hge2-insane', title: '极限挑战 · 疯狂篇', icon: '👿', ability: '记忆力', entryFee: 15,
    description: 'HGE2 原版复刻 19-24 关：极限记忆与反应的终极考验！',
    theme: { label: 'INSANE', color: '#5C6BC0', dark: '#1a237e' },
    stages: [
      { num: 19, name: '让我们去钓鱼', icon: '🎣',
        rules: ['钓竿晃动时点击并翻转设备（原版玩法）'], disabled: '需要翻转手机体感，暂未开放',
        higherBetter: false, t: [400, 500, 550, 600, 700, 800], fmt: 'msInt', metricName: '平均用时' },
      { num: 20, name: '高点数骰子大师', icon: '🎲',
        rules: ['三组骰子，快速选出点数之和最大的一组', '骰子从 3 个加到 6 个再加到 9 个', '选错失败，共 9 轮！'],
        higherBetter: false, t: [400, 500, 600, 700, 750, 800], fmt: 'msInt', metricName: '平均每轮' },
      { num: 21, name: '我讨厌分数', icon: '➗',
        rules: ['两个分数，以最快速度点出更大的那个', '交叉相乘比大小最快', '点错失败，共 10 题！'],
        higherBetter: false, t: [300, 350, 400, 450, 520, 600], fmt: 'msInt', metricName: '平均每题' },
      { num: 22, name: '谁在放屁', icon: '💨',
        rules: ['记住三个人放屁的顺序', '然后按同样顺序点他们', '序列越来越长，错一个就结束！'],
        higherBetter: true, t: [40, 36, 32, 28, 24, 20], fmt: 'pts', metricName: '得分' },
      { num: 23, name: '超级记忆巴士', icon: '🚌',
        rules: ['巴士飞驰而过，记住车上乘客的特征', '开走后提问：戴某种颜色帽子的有几人？', '答错失败，共 6 轮，巴士越来越快！'],
        higherBetter: false, t: [500, 550, 600, 650, 680, 700], fmt: 'msInt', metricName: '平均每轮' },
      { num: 24, name: '火柴人跳崖', icon: '🏃',
        rules: ['4 秒狂点 RUN 积蓄速度', '冲到悬崖边的最佳时机点 JUMP 起跳', '跳得太早太短，太晚直接掉下去！'],
        higherBetter: true, t: [280, 272, 265, 258, 253, 250], fmt: 'pts', metricName: '得分' },
    ],
  },
];

function fmtMetric(stage, m) {
  return (FMT[stage.fmt] || FMT.ms)(m);
}

/** 关卡锁定：占位关/未实现关永远锁定；其余需按顺序通关（F 不算通过） */
function stageLocked(tier, grades, i) {
  const s = tier.stages[i];
  if (s.disabled || !s.mechanic) return true;
  for (let j = 0; j < i; j++) {
    const pj = tier.stages[j];
    if (pj.disabled || !pj.mechanic) continue;
    const g = grades[String(j)];
    if (!g || g === 'F') return true;
  }
  return false;
}

/** 整档锁定：第 2 档起需通关上一档全部已开放关卡 */
function tierLockedReason(tierIndex) {
  if (tierIndex <= 0) return null;
  const prev = HGE2_TIERS[tierIndex - 1];
  const grades = getProgress(prev.id).grades;
  const done = prev.stages.every((s, i) => {
    if (s.disabled || !s.mechanic) return true;
    const g = grades[String(i)];
    return !!g && g !== 'F';
  });
  return done ? null : `先通关「${prev.title}」全部关卡`;
}

function findTier(tierId) {
  return HGE2_TIERS.find((t) => t.id === tierId) || HGE2_TIERS[0];
}

module.exports = { HGE2_TIERS, fmtMetric, stageLocked, tierLockedReason, findTier };
