# 数感星球 —— 系统架构与扩展指南

## 设计目标

面向中学生的碎片化数感训练：分年级分单元的快问快答（赚积分）+ 消耗积分的专注力/记忆力/反应力小游戏（排行榜）。核心是**数据驱动、引擎复用、防瞎猜**。

## 分层架构

```
src/
├─ core/                  领域核心（与 UI 无关，可整体复用/迁移到服务端）
│  ├─ types.ts            Grade → Unit → Skill → QuestionGenerator 的领域模型
│  ├─ scoring.ts          计分规则：对错 / 用时 / 连对 三维综合，答错扣分
│  ├─ wallet.ts           积分钱包（localStorage 持久化 + 跨页订阅）
│  └─ leaderboard.ts      小游戏本地排行榜（每游戏 Top10）
├─ data/
│  └─ bank.ts             题库注册表：年级树 + 题目生成器 + 一局组卷逻辑
├─ quiz/                  快问快答引擎（所有 Skill 复用）
│  ├─ QuizIntro.tsx       考核点引导页
│  └─ QuizRunner.tsx      超大题面 + 秒级倒数进度条 + 干扰项讲解 + 结算
├─ games/                 小游戏（消耗积分入场）
│  ├─ registry.ts         游戏元信息注册表（游戏厅自动渲染）
│  ├─ MemoryFlash.tsx     数字闪现（记忆力）
│  └─ ReactionTap.tsx     极速点击（反应力，抢跑罚时）
└─ pages/                 Home（年级单元浏览）/ GamesHall（游戏厅+榜单）
```

## 三个关键扩展点

### 1. 新增考核内容（最重要）

只需在 `data/bank.ts` 里写一个 `Skill` 并挂到年级树上，引擎/计分/积分入账全自动复用：

```ts
const mySkill: Skill = {
  id: 'g6-percent-convert',
  title: '百分数 ⇄ 小数',
  intro: ['考核点：……', '每题限时 8 秒……'],
  timeLimitSec: 8,
  questionCount: 10,
  generators: [myGenerator],   // (rng) => Question
};
```

生成器约定：返回**正确答案 + 1~3 个「误区干扰项」**。每个干扰项带 `trap` 标签（如"未约分""数位拼接"），答错时即时讲解——干扰项不是随机凑数，而是针对典型错误设计，这是防瞎猜的第一层。

题面与选项使用结构化数学表达式 `MathExpr`（`text` / `frac` / `mixed`），由 `src/components/MathView.tsx` 渲染为规范排版（分子在上、分数线、分母在下；带分数为整数+并排分数），而不是 "1/8"、"1又3/4" 这类纯文本写法。去重基于表达式序列化键，与显示无关。

### 2. 防瞎猜的三层机制

1. **误区干扰项**：选项覆盖典型错误路径，猜中概率被稀释且错了能学到东西；
2. **负分惩罚**：`scoring.ts` 中答错 −6，超时 0，连对有加成——乱猜期望收益为负；
3. **限时进度条**：每题按秒倒数，压缩"逐个试"的空间。

### 3. 新增小游戏

在 `games/registry.ts` 登记元信息（入场费、能力维度、分数标签），写一个页面组件，加一条路由即可。积分出入账统一走 `core/wallet.ts`（`spendPoints` 余额不足返回 null），上榜统一走 `core/leaderboard.ts`。

## 后续路线

- **账号与云同步**：wallet / leaderboard 已隔离为数据层，替换 load/save 实现即可接服务端，获得跨设备进度和真实排名；
- **可复现组卷**：`generateQuiz(skill, seed)` 使用 mulberry32 种子随机，可支持"每日挑战"（所有人同一份题）和错题复盘；
- **错题本**：`Question.choices[].trap` 已记录误区标签，可按标签聚合作答记录生成薄弱点报告；
- **更多题型**：Question 模型可扩展填空/拖拽，QuizRunner 增加对应渲染器即可。
