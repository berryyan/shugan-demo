import SwiftUI

/**
 * 数学表达式渲染 —— 与网页版 MathView.tsx 一致：
 * 分数显示为分子在上、分数线、分母在下的标准排版；带分数为整数 + 并排分数；
 * 运算式中负数项自动加括号（有理数标准写法）。
 * fontSize 相当于网页版的基准字号（em 基准）。
 */
struct MathExprView: View {
    let expr: MathExpr
    var fontSize: CGFloat = 28
    var color: Color = .slate800

    var body: some View {
        content(expr)
            .foregroundColor(color)
    }

    // 递归渲染（MathExpr 是递归枚举），必须显式返回 AnyView，否则 some View 无法推断
    private func content(_ e: MathExpr) -> AnyView {
        switch e {
        case .text(let t):
            // 负数显示为标准减号 −（比半角连字符更长更醒目）并标红（2026-10-02 女儿反馈看不清正负号）
            let neg = t.hasPrefix("-")
            return AnyView(
                Text(t.replacingOccurrences(of: "-", with: "−"))
                    .font(.system(size: fontSize, weight: .black))
                    .monospacedDigit()
                    .lineLimit(1)
                    .foregroundColor(neg ? .red600 : color)
            )
        case .frac(let n, let d):
            return AnyView(FracView(n: n, d: d, fontSize: fontSize))
        case .mixed(let w, let n, let d):
            return AnyView(
                HStack(alignment: .center, spacing: fontSize * 0.12) {
                    Text(w)
                        .font(.system(size: fontSize, weight: .black))
                        .monospacedDigit()
                    FracView(n: n, d: d, fontSize: fontSize)
                }
            )
        case .vs(let left, let right):
            return AnyView(
                HStack(alignment: .center, spacing: fontSize * 0.35) {
                    content(left)
                    Text("?")
                        .font(.system(size: fontSize, weight: .black))
                        .foregroundColor(.slate300)
                    content(right)
                }
            )
        case .op(let op, let terms):
            return AnyView(
                HStack(alignment: .center, spacing: fontSize * 0.3) {
                    ForEach(Array(terms.enumerated()), id: \.offset) { i, t in
                        HStack(alignment: .center, spacing: fontSize * 0.3) {
                            if i > 0 {
                                Text(op == "-" ? "−" : op)
                                    .font(.system(size: fontSize, weight: .black))
                                    .foregroundColor(.indigo400)
                            }
                            // 负数项加括号：(-3) + (-5)
                            if case .text(let txt) = t, txt.hasPrefix("-") {
                                HStack(alignment: .center, spacing: 0) {
                                    Text("(")
                                        .font(.system(size: fontSize, weight: .black))
                                        .foregroundColor(.slate400)
                                    content(t)
                                    Text(")")
                                        .font(.system(size: fontSize, weight: .black))
                                        .foregroundColor(.slate400)
                                }
                            } else {
                                content(t)
                            }
                        }
                    }
                }
            )
        }
    }
}

/** 分数排版：分子在上、分数线、分母在下（0.62em 相对字号，与网页版一致） */
struct FracView: View {
    let n: String
    let d: String
    let fontSize: CGFloat

    private var innerSize: CGFloat { fontSize * 0.62 }

    var body: some View {
        VStack(spacing: 0) {
            Text(n)
                .font(.system(size: innerSize, weight: .bold))
                .monospacedDigit()
                .padding(.horizontal, fontSize * 0.09)
                .padding(.bottom, fontSize * 0.05)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .frame(height: max(1.5, fontSize * 0.045))
                }
            Text(d)
                .font(.system(size: innerSize, weight: .bold))
                .monospacedDigit()
                .padding(.horizontal, fontSize * 0.09)
                .padding(.top, fontSize * 0.05)
        }
    }
}

/**
 * 自适应宽度数学表达式 —— ViewThatFits 字号阶梯：
 * 从基准字号逐级缩小（×0.85，共 7 档），第一档能完整放下就用哪档。
 * 最长题面（4 项带小数乘除式）在最小档约 17pt 也远小于屏幕宽度，保证永不溢出。
 * （2026-10-02 重写：旧 FitView 的 PreferenceKey 测量在长式子上失效，
 *   导致乘除符号快闪题面被屏幕边缘裁切——女儿反馈"看不清正负号"的真因）
 */
struct FitMathExpr: View {
    let expr: MathExpr
    var fontSize: CGFloat = 44
    var color: Color = .slate800

    private var sizes: [CGFloat] {
        (0..<7).map { fontSize * pow(0.85, CGFloat($0)) }
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            ForEach(sizes, id: \.self) { s in
                MathExprView(expr: expr, fontSize: s, color: color)
                    .fixedSize()
            }
        }
        .frame(maxWidth: .infinity)
    }
}
