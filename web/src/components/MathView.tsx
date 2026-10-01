import type { MathExpr } from '@/core/types';

/**
 * 数学表达式渲染：分数显示为分子在上、分数线、分母在下的标准排版；
 * 带分数为整数 + 并排分数。size 控制整体字号（继承 em）。
 */
export default function MathView({
  expr,
  className = '',
}: {
  expr: MathExpr;
  className?: string;
}) {
  if (expr.kind === 'text') {
    // 负数显示为标准减号 −（比半角连字符更长更醒目）并标红（2026-10-02 女儿反馈看不清正负号）
    const neg = expr.text.startsWith('-');
    return (
      <span className={`${neg ? 'text-red-600 ' : ''}${className}`}>
        {expr.text.replace(/-/g, '−')}
      </span>
    );
  }
  if (expr.kind === 'frac') {
    return <Frac n={expr.n} d={expr.d} className={className} />;
  }
  if (expr.kind === 'vs') {
    return (
      <span className={`inline-flex items-center gap-[0.35em] ${className}`}>
        <MathView expr={expr.left} />
        <span className="text-slate-300 font-black">?</span>
        <MathView expr={expr.right} />
      </span>
    );
  }
  if (expr.kind === 'op') {
    return (
      <span className={`inline-flex items-center gap-[0.3em] ${className}`}>
        {expr.terms.map((t, i) => {
          // 负数项加括号：(-3) + (-5) 的有理数标准写法
          const neg = t.kind === 'text' && t.text.startsWith('-');
          return (
            <span key={i} className="inline-flex items-center gap-[0.3em]">
              {i > 0 && <span className="text-indigo-400 font-black">{expr.op === '-' ? '−' : expr.op}</span>}
              {neg ? (
                <span className="inline-flex items-center">
                  <span className="text-slate-400">(</span>
                  <MathView expr={t} />
                  <span className="text-slate-400">)</span>
                </span>
              ) : (
                <MathView expr={t} />
              )}
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-[0.12em] ${className}`}>
      <span>{expr.whole}</span>
      <Frac n={expr.n} d={expr.d} />
    </span>
  );
}

function Frac({ n, d, className = '' }: { n: string; d: string; className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center leading-none align-middle ${className}`}
      style={{ fontSize: '0.62em' }}
    >
      <span className="px-[0.15em] pb-[0.08em] border-b-[0.06em] border-current font-bold">
        {n}
      </span>
      <span className="px-[0.15em] pt-[0.08em] font-bold">{d}</span>
    </span>
  );
}
