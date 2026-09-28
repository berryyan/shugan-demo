import Foundation
import Combine

/**
 * 家长设置 —— 家长密码（4 位 PIN）+ 愿望激励配置。与网页版 core/settings.ts 一致。
 *
 * 愿望激励：家长设置目标分（1000 为单位）+ 愿望文本；
 * 孩子积分余额达到目标后可兑换，兑换时从余额扣掉目标分，
 * 兑换后配置作废，设置页提醒家长兑现并设置新愿望。
 */

struct Wish: Codable, Equatable {
    var target: Int    // 目标积分（1000 的倍数）
    var text: String   // 愿望内容，如 "周末短途游"
}

struct RedeemedWish: Codable, Equatable {
    var target: Int
    var text: String
    var ts: TimeInterval // 毫秒时间戳
}

struct AppSettings: Codable, Equatable {
    var pin: String?              // 家长密码（未设置 = nil）
    var wish: Wish?               // 当前生效的愿望
    var lastRedeemed: RedeemedWish? // 最近一次已兑换的愿望（提醒家长兑现）
}

final class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    private let key = "shugan.settings.v1"
    @Published private(set) var settings: AppSettings

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let s = try? JSONDecoder().decode(AppSettings.self, from: data) {
            settings = s
        } else {
            settings = AppSettings()
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /** 设置/修改家长密码 */
    func setPin(_ pin: String) {
        settings.pin = pin
        save()
    }

    /** 校验家长密码 */
    func verifyPin(_ pin: String) -> Bool {
        settings.pin == pin
    }

    /** 保存愿望配置 */
    func setWish(_ wish: Wish?) {
        settings.wish = wish
        save()
    }

    /** 孩子兑换愿望：记录到 lastRedeemed 并清空当前配置（积分扣减由调用方走钱包） */
    @discardableResult
    func redeemWish() -> Wish? {
        guard let w = settings.wish else { return nil }
        settings.lastRedeemed = RedeemedWish(target: w.target, text: w.text, ts: Date().timeIntervalSince1970 * 1000)
        settings.wish = nil
        save()
        return w
    }

    /** 家长已读"已兑换"提醒 */
    func ackRedeemed() {
        settings.lastRedeemed = nil
        save()
    }
}
