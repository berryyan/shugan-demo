import SwiftUI

/** 设置页（家长）：4 位 PIN 门禁 → 当日学习记录 / 积分激励（愿望）/ 修改密码 / 重置分数。对应网页版 Settings.tsx */
struct SettingsView: View {
    @ObservedObject private var settingsStore = SettingsStore.shared
    @State private var unlocked = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("设置")
                        .font(.system(size: 26, weight: .black))
                        .foregroundColor(.slate800)
                    Text("家长专用")
                        .font(.system(size: 14))
                        .foregroundColor(.slate400)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                if unlocked {
                    SettingsBodyView()
                        .padding(.horizontal, 16)
                } else {
                    PinGateView(hasPin: settingsStore.settings.pin != nil) {
                        unlocked = true
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 24)
                }
            }
            .padding(.bottom, 32)
        }
        .background(Color.slate50.ignoresSafeArea())
    }
}

/* ---------------- 家长密码门禁 ---------------- */

private struct PinGateView: View {
    let hasPin: Bool
    let onUnlock: () -> Void

    @State private var pin = ""
    @State private var confirm: String? = nil
    @State private var error = ""

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.slate300)
                    .padding(.top, 8)

                Text(hasPin ? "输入家长密码" : (confirm != nil ? "再输一次确认" : "设置家长密码"))
                    .font(.system(size: 18, weight: .black))
                    .foregroundColor(.slate800)
                Text(hasPin ? "4 位数字" : "4 位数字，防止孩子改设置")
                    .font(.system(size: 14))
                    .foregroundColor(.slate400)

                SecureField("····", text: $pin)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 28, weight: .black))
                    .frame(height: 56)
                    .background(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.slate200, lineWidth: 2))
                    .onChange(of: pin) { newValue in
                        let digits = newValue.filter { $0.isNumber }
                        pin = String(digits.prefix(4))
                    }

                if !error.isEmpty {
                    Text(error)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.red500)
                }

                Button(action: submit) {
                    Text(hasPin ? "解锁" : (confirm != nil ? "确认" : "下一步"))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.indigo600)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }
            .padding(24)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
        }
    }

    private func submit() {
        guard pin.count == 4 else {
            error = "请输入 4 位数字"
            return
        }
        if !hasPin {
            if confirm == nil {
                confirm = pin
                pin = ""
                error = ""
                return
            }
            if confirm != pin {
                error = "两次输入不一致，请重新设置"
                confirm = nil
                pin = ""
                return
            }
            SettingsStore.shared.setPin(pin)
            onUnlock()
            return
        }
        if SettingsStore.shared.verifyPin(pin) {
            onUnlock()
        } else {
            error = "密码不对"
            pin = ""
        }
    }
}

/* ---------------- 设置内容 ---------------- */

private struct SettingsBodyView: View {
    @ObservedObject private var settingsStore = SettingsStore.shared
    @ObservedObject private var walletStore = WalletStore.shared
    @ObservedObject private var logStore = StudyLogStore.shared

    // 愿望表单
    @State private var target = 2000
    @State private var wishText = ""
    @State private var wishMsg = ""

    // 修改密码
    @State private var pinMsg = ""

    // 重置分数
    @State private var resetArmed = false
    @State private var resetDone = false

    private let targets = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000]

    private static let modeLabel: [String: String] = ["review": "📝 复习", "normal": "🎯 闯关", "advanced": "⚡ 进阶"]

    var body: some View {
        let settings = settingsStore.settings
        let sum = logStore.daySummary()
        let log = logStore.dayLog()

        VStack(spacing: 20) {
            // 已兑换提醒
            if let redeemed = settings.lastRedeemed {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.emerald500)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("愿望「\(redeemed.text)」（\(redeemed.target) 分）已于 \(redeemedDate(redeemed.ts)) 兑换")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.emerald700)
                        Text("记得兑现承诺，并在下方设置新愿望！")
                            .font(.system(size: 12))
                            .foregroundColor(.emerald600)
                    }
                    Spacer()
                    Button("知道了") {
                        settingsStore.ackRedeemed()
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.emerald600)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.emerald300, lineWidth: 1))
                }
                .padding(16)
                .background(Color.emerald50)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.emerald300, lineWidth: 2))
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }

            // 当日学习记录
            SettingsSection(title: "当日学习记录") {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        StatCell(label: "局数", value: "\(sum.sessions)")
                        StatCell(label: "答题", value: "\(sum.correctQ)/\(sum.totalQ)")
                        StatCell(label: "正确率", value: "\(sum.accuracy)%")
                        StatCell(label: "积分", value: "\(sum.earned >= 0 ? "+" : "")\(sum.earned)")
                    }
                    if log.isEmpty {
                        Text("今天还没有学习记录")
                            .font(.system(size: 14))
                            .foregroundColor(.slate300)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(Array(log.enumerated()), id: \.offset) { _, e in
                                HStack(spacing: 8) {
                                    Text(hhmm(e.ts))
                                        .font(.system(size: 13))
                                        .monospacedDigit()
                                        .foregroundColor(.slate300)
                                    Text(e.skillTitle)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.slate700)
                                        .lineLimit(1)
                                    Text(Self.modeLabel[e.mode] ?? e.mode)
                                        .font(.system(size: 12))
                                    Spacer()
                                    Text("\(e.correct)/\(e.total) 题")
                                        .font(.system(size: 13))
                                        .foregroundColor(.slate500)
                                    Text("\(e.earned >= 0 ? "+" : "")\(e.earned)")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(e.earned >= 0 ? .indigo600 : .red500)
                                        .frame(width: 48, alignment: .trailing)
                                }
                            }
                        }
                    }
                }
            }

            // 积分激励（愿望）
            SettingsSection(title: "🎁 积分激励（愿望兑换）") {
                if let wish = settings.wish {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("进行中：\(wish.target) 分 → 「\(wish.text)」")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.amber700)
                        let pct = min(100, Int((Double(walletStore.wallet.points) / Double(wish.target) * 100).rounded()))
                        Text("孩子当前 \(walletStore.wallet.points) 分（\(pct)%）")
                            .font(.system(size: 12))
                            .foregroundColor(.amber600)
                        Button {
                            settingsStore.setWish(nil)
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "trash")
                                    .font(.system(size: 11))
                                Text("删除这个愿望")
                                    .font(.system(size: 12, weight: .bold))
                            }
                            .foregroundColor(.red300)
                            .padding(.top, 4)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(Color.amber50)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    VStack(spacing: 12) {
                        HStack {
                            Text("目标分")
                                .font(.system(size: 14))
                                .foregroundColor(.slate500)
                            Picker("目标分", selection: $target) {
                                ForEach(targets, id: \.self) { v in
                                    Text("\(v) 分").tag(v)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.slate200, lineWidth: 2))
                            .tint(.slate700)
                        }
                        TextField("愿望内容，如：奖励零用钱 5 元", text: $wishText)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.slate700)
                            .padding(.horizontal, 12)
                            .frame(height: 44)
                            .background(Color.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.slate200, lineWidth: 2))
                            .onChange(of: wishText) { newValue in
                                if newValue.count > 20 { wishText = String(newValue.prefix(20)) }
                            }
                        Button(action: saveWish) {
                            Text("保存愿望")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.amber500)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        if !wishMsg.isEmpty {
                            Text(wishMsg)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.amber600)
                        }
                        Text("孩子积分达到目标后可自行点击兑换（扣除目标分），兑换后这里会提醒你兑现并设置新愿望。")
                            .font(.system(size: 12))
                            .foregroundColor(.slate400)
                    }
                }
            }

            // 家长密码
            SettingsSection(title: "家长密码") {
                ChangePinView { msg in
                    pinMsg = msg
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { pinMsg = "" }
                }
                if !pinMsg.isEmpty {
                    Text(pinMsg)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.indigo600)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
            }

            // 重置分数
            VStack(spacing: 12) {
                if !resetArmed {
                    Button {
                        resetArmed = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.counterclockwise")
                            Text("重置分数")
                                .font(.system(size: 16, weight: .black))
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.red600)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                } else {
                    Text("确定清零？积分余额和学习记录将全部清空")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.red600)
                        .multilineTextAlignment(.center)
                    HStack(spacing: 12) {
                        Button {
                            resetArmed = false
                        } label: {
                            Text("取消")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.slate500)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.slate100)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        Button {
                            walletStore.reset()
                            logStore.clear()
                            resetArmed = false
                            resetDone = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { resetDone = false }
                        } label: {
                            Text("确认清零")
                                .font(.system(size: 15, weight: .black))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.red600)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                if resetDone {
                    Text("已清零 ✓")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.red500)
                }
                Text("调试用：积分与学习记录清零")
                    .font(.system(size: 12))
                    .foregroundColor(.slate400)
            }
            .padding(16)
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.red100, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func saveWish() {
        let text = wishText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else {
            wishMsg = "请填写愿望内容"
            return
        }
        settingsStore.setWish(Wish(target: target, text: text))
        wishText = ""
        wishMsg = "已保存 ✓"
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { wishMsg = "" }
    }

    private func redeemedDate(_ ts: TimeInterval) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "zh_CN")
        df.dateFormat = "M月d日"
        return df.string(from: Date(timeIntervalSince1970: ts / 1000))
    }

    private func hhmm(_ ts: TimeInterval) -> String {
        let df = DateFormatter()
        df.dateFormat = "HH:mm"
        return df.string(from: Date(timeIntervalSince1970: ts / 1000))
    }
}

/* ---------------- 小组件 ---------------- */

private struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.slate500)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.slate50)
            content
                .padding(16)
        }
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
    }
}

private struct StatCell: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 17, weight: .black))
                .foregroundColor(.slate800)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.slate400)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.slate50)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/** 修改密码：旧密码 → 新密码 */
private struct ChangePinView: View {
    let onDone: (String) -> Void

    @State private var oldPin = ""
    @State private var newPin = ""
    @State private var stepNew = false

    var body: some View {
        HStack(spacing: 8) {
            SecureField(stepNew ? "新密码（4 位数字）" : "原密码", text: stepNew ? $newPin : $oldPin)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 16, weight: .bold))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Color.white)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.slate200, lineWidth: 2))
                .onChange(of: oldPin) { v in oldPin = String(v.filter { $0.isNumber }.prefix(4)) }
                .onChange(of: newPin) { v in newPin = String(v.filter { $0.isNumber }.prefix(4)) }

            Button(action: submit) {
                Text(stepNew ? "确认修改" : "下一步")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .frame(height: 44)
                    .background(Color.indigo600)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func submit() {
        if !stepNew {
            guard SettingsStore.shared.verifyPin(oldPin) else {
                onDone("原密码不对")
                oldPin = ""
                return
            }
            stepNew = true
            return
        }
        guard newPin.count == 4 else {
            onDone("新密码需要 4 位数字")
            return
        }
        SettingsStore.shared.setPin(newPin)
        stepNew = false
        oldPin = ""
        newPin = ""
        onDone("密码已修改 ✓")
    }
}
