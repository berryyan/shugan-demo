import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * 自适应宽度容器：内容（数学表达式）超出容器宽度时整体等比缩小，
 * 保证任意项数、任意形态的表达式永不超出屏幕宽度。
 * 统一解决方案——所有题面/选项渲染都经过它，不再需要按题型单独修宽度。
 */
export default function FitText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const o = outer.current;
      const i = inner.current;
      if (!o || !i) return;
      i.style.transform = 'none';
      const ratio = o.clientWidth / Math.max(1, i.scrollWidth);
      i.style.transform = ratio < 1 ? `scale(${ratio})` : 'none';
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outer} className={`w-full flex justify-center overflow-hidden ${className}`}>
      <div ref={inner} className="inline-block whitespace-nowrap" style={{ transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}
