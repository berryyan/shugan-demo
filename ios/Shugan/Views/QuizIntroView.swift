import SwiftUI

/** 知识点引导页：说明考核内容 + 三模式入口（复习填空 / 闯关选择 / 进阶考场）。对应网页版 QuizIntro.tsx */
struct QuizIntroView: View {
    let skill: Skill
    @ObservedObject private var wallet = WalletStore.shared

    var body: some View {
        let review = modeParams(skill, .review)
        let normal = modeParams(skill, .normal)
        let advanced = modeParams(skill, .advanced)

        ScrollView {
            VStack(spacing: 20) {
                // 考前必读
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 8) {
                        Image(systemName: "target")
                            .font(.system(size: 16, weight: .bold))
                        Text("考前必读")
                            .font(.system(size: 16, weight: .bold))
                    }
                    .foregroundColor(.indigo600)

                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(Array(skill.intro.enumerated()), id: \.offset) { i, line in
                            HStack(alignment: .top, spacing: 8) {
                                Text("\(i + 1)")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.indigo600)
                                    .frame(width: 20, height: 20)
                                    .background(Color.indigo100)
                                    .clipShape(Circle())
                                    .padding(.top, 1)
                                Text(line)
                                    .font(.system(size: 15))
                                    .foregroundColor(.slate700)
                                    .lineSpacing(4)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)

                // 三模式入口
                VStack(spacing: 14) {
                    if skill.supportsReview {
                        NavigationLink(value: AppRoute.quiz(skill.id, .review)) {
                            ModeButtonLabel(text: "📝 复习模式 · 填空", bg: .emerald600, shadow: .emerald300)
                        }
                        .buttonStyle(.plain)
                        Text("\(review.count) 题 · 每题 \(review.timeLimitSec) 秒 · 自己填答案，填错提示原因可重填")
                            .font(.system(size: 12))
                            .foregroundColor(.slate400)
                            .multilineTextAlignment(.center)
                            .padding(.top, -6)
                    }

                    NavigationLink(value: AppRoute.quiz(skill.id, .normal)) {
                        ModeButtonLabel(text: "🎯 闯关模式 · 选择", bg: .indigo600, shadow: .indigo100)
                    }
                    .buttonStyle(.plain)
                    Text("\(normal.count) 题 · 每题 \(normal.timeLimitSec) 秒 · 4 个选项，答错扣分但可以继续")
                        .font(.system(size: 12))
                        .foregroundColor(.slate400)
                        .multilineTextAlignment(.center)
                        .padding(.top, -6)

                    NavigationLink(value: AppRoute.quiz(skill.id, .advanced)) {
                        Text("⚡ 进阶模式 · 全对翻倍")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.red600)
                            .frame(maxWidth: .infinity)
                            .frame(height: 64)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.red300, lineWidth: 2))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    Text("\(advanced.count) 题 · 每题 \(advanced.timeLimitSec) 秒 · 全对积分 ×2，错一题或超时本局归零")
                        .font(.system(size: 12))
                        .foregroundColor(.slate400)
                        .multilineTextAlignment(.center)
                        .padding(.top, -6)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .background(
            LinearGradient(colors: [.indigo50, .white], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
        .navigationTitle(skill.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 13))
                    Text("\(wallet.wallet.points)")
                        .font(.system(size: 15, weight: .bold))
                        .monospacedDigit()
                }
                .foregroundColor(.amber700)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Color.amber100)
                .clipShape(Capsule())
            }
        }
    }
}

private struct ModeButtonLabel: View {
    let text: String
    let bg: Color
    let shadow: Color

    var body: some View {
        Text(text)
            .font(.system(size: 20, weight: .bold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: shadow, radius: 8, y: 4)
    }
}
