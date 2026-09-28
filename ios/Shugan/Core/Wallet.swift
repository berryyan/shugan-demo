import Foundation
import Combine

/**
 * 积分钱包 —— 快问快答赚取积分，愿望激励消耗积分。
 * UserDefaults 持久化（键与网页版一致）；ObservableObject 驱动 SwiftUI 刷新。
 */

struct Wallet: Codable, Equatable {
    var points = 0
    var totalEarned = 0
    var totalSpent = 0
}

final class WalletStore: ObservableObject {
    static let shared = WalletStore()

    private let key = "shugan.wallet.v1"
    @Published private(set) var wallet: Wallet

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let w = try? JSONDecoder().decode(Wallet.self, from: data) {
            wallet = w
        } else {
            wallet = Wallet()
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(wallet) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /** 加积分（负数也会先扣到 0 为止，积分不为负） */
    @discardableResult
    func addPoints(_ delta: Int) -> Wallet {
        wallet.points = max(0, wallet.points + delta)
        if delta > 0 { wallet.totalEarned += delta }
        save()
        return wallet
    }

    /** 消耗积分；余额不足返回 nil */
    @discardableResult
    func spendPoints(_ amount: Int) -> Wallet? {
        guard wallet.points >= amount else { return nil }
        wallet.points -= amount
        wallet.totalSpent += amount
        save()
        return wallet
    }

    /** 重置分数（家长在设置页手动操作）：积分全部清零，学习记录同时清空 */
    func reset() {
        wallet = Wallet()
        save()
    }
}
