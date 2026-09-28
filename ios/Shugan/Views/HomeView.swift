import SwiftUI

/** 路由：题库引导页 / 答题页 */
enum AppRoute: Hashable {
    case intro(String)
    case quiz(String, QuizMode)
}

/** 首页：分年级分单元浏览知识点 + 积分钱包入口（对应网页版 Home.tsx） */
struct HomeView: View {
    @ObservedObject private var wallet = WalletStore.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // 顶栏：标题 + 积分
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("数学不再难")
                            .font(.system(size: 26, weight: .black))
                            .foregroundColor(.slate800)
                        Text("快问快答 · 练出数感")
                            .font(.system(size: 14))
                            .foregroundColor(.slate400)
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 16))
                        Text("\(wallet.wallet.points)")
                            .font(.system(size: 18, weight: .black))
                            .monospacedDigit()
                    }
                    .foregroundColor(.amber700)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.amber100)
                    .clipShape(Capsule())
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                WishBannerView()

                ForEach(GRADES, id: \.id) { grade in
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 8) {
                            Image(systemName: "book.closed")
                                .font(.system(size: 14))
                            Text(grade.title)
                                .font(.system(size: 16, weight: .bold))
                            if !grade.available {
                                Text("即将上线")
                                    .font(.system(size: 12))
                                    .foregroundColor(.slate400)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.slate100)
                                    .clipShape(Capsule())
                            }
                        }
                        .foregroundColor(.slate500)
                        .padding(.horizontal, 16)

                        VStack(spacing: 12) {
                            ForEach(grade.units, id: \.id) { unit in
                                UnitCard(unit: unit)
                            }
                            if grade.units.isEmpty {
                                VStack(spacing: 4) {
                                    Image(systemName: "lock")
                                        .foregroundColor(.slate300)
                                    Text("敬请期待")
                                        .font(.system(size: 14))
                                        .foregroundColor(.slate300)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 24)
                                .background(Color.white.opacity(0.6))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(
            LinearGradient(colors: [.indigo50, .white], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
        .navigationBarHidden(true)
    }
}

/** 单元卡片：单元标题 + 题库列表 */
private struct UnitCard: View {
    let unit: Unit

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(unit.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.slate500)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.slate50)

            if unit.skills.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "lock")
                        .font(.system(size: 14))
                    Text("内容筹备中")
                        .font(.system(size: 14))
                }
                .foregroundColor(.slate300)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(unit.skills, id: \.id) { skill in
                    NavigationLink(value: AppRoute.intro(skill.id)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(skill.title)
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.slate800)
                                Text("\(skill.questionCount) 题 · 每题 \(skill.timeLimitSec) 秒")
                                    .font(.system(size: 12))
                                    .foregroundColor(.slate400)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.slate300)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if skill.id != unit.skills.last?.id {
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}
