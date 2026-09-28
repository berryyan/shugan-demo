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
            return AnyView(
                Text(t)
                    .font(.system(size: fontSize, weight: .black))
                    .monospacedDigit()
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
                                Text(op)
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

/** 内容尺寸测量键（FitView 用） */
private struct ContentSizeKey: PreferenceKey {
    static let defaultValue: CGSize = .zero
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) { value = nextValue() }
}

/**
 * 自适应宽度容器 —— 网页版 FitText 的 SwiftUI 版：
 * 内容超出容器宽度时整体等比缩小，任意项数、任意形态的表达式永不超出屏幕宽度。
 */
struct FitView<Content: View>: View {
    @ViewBuilder var content: Content
    @State private var contentSize: CGSize = .zero

    var body: some View {
        GeometryReader { geo in
            let scale = contentSize.width > 0 ? min(1, geo.size.width / contentSize.width) : 1
            content
                .fixedSize()
                .background(
                    GeometryReader { g in
                        Color.clear.preference(key: ContentSizeKey.self, value: g.size)
                    }
                )
                .scaleEffect(scale, anchor: .center)
                .frame(width: geo.size.width, height: geo.size.height)
        }
        .onPreferenceChange(ContentSizeKey.self) { contentSize = $0 }
    }
}
