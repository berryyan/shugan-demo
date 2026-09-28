import SwiftUI

/**
 * 愿望激励条（孩子侧）—— 对应网页版 WishBanner.tsx。
 * 家长设置了愿望后显示在学习页顶部。
 * 未达标：进度条"还差 N 分"；达标：金色可点，点击弹窗确认兑换（扣除目标分，愿望作废）。
 */
struct WishBannerView: View {
    @ObservedObject private var wallet = WalletStore.shared
    @ObservedObject private var settings = SettingsStore.shared
    @State private var confirming = false
    @State private var justRedeemed: String? = nil

    var body: some View {
        Group {
            if let redeemed = justRedeemed {
                // 兑换成功提示
                VStack(spacing: 6) {
                    Text("🎉")
                        .font(.system(size: 32))
                    Text("已兑换「\(redeemed)」")
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.emerald700)
                    Text("快去找家长兑现吧！")
                        .font(.system(size: 14))
                        .foregroundColor(.emerald600)
                    Button("好的") { justRedeemed = nil }
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 8)
                        .background(Color.emerald600)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.top, 4)
                }
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(Color.emerald50)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.emerald300, lineWidth: 2))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 16)
            } else if let wish = settings.settings.wish {
                let reached = wallet.wallet.points >= wish.target
                let pct = min(1, Double(wallet.wallet.points) / Double(wish.target))
                Button {
                    if reached { confirming = true }
                } label: {
                    VStack(spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "gift.fill")
                                .foregroundColor(reached ? .amber500 : .amber400)
                            Text("愿望：\(wish.text)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.slate700)
                                .lineLimit(1)
                            Spacer()
                            Text(reached ? "点我兑换 🎁" : "还差 \(wish.target - wallet.wallet.points) 分")
                                .font(.system(size: 14, weight: .black))
                                .foregroundColor(reached ? .amber600 : .slate400)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.amber100)
                                Capsule()
                                    .fill(reached ? Color.amber500 : Color.amber400)
                                    .frame(width: geo.size.width * pct)
                            }
                        }
                        .frame(height: 8)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity)
                    .background(reached ? Color.amber50 : Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(reached ? Color.amber400 : Color.amber200, lineWidth: 2)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: reached ? .amber100 : .clear, radius: 8)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .alert("兑换愿望？", isPresented: $confirming) {
                    Button("再想想", role: .cancel) {}
                    Button("确认兑换") {
                        WalletStore.shared.addPoints(-wish.target)
                        if let w = SettingsStore.shared.redeemWish() {
                            justRedeemed = w.text
                        }
                    }
                } message: {
                    Text("「\(wish.text)」将扣除 \(wish.target) 积分，\n兑换后记得找家长兑现哦！")
                }
            }
        }
    }
}
