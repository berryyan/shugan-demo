import SwiftUI

/**
 * 快问快答引擎（三模式）—— 与网页版 QuizRunner.tsx 逻辑一一对应。
 * - 复习模式：20 题、限时 ×1.5，填空作答（数字键盘 + 分数线 + 带分数空格），填错扣分提示原因可重填
 * - 闯关模式：10 题、基准限时，固定 4 选项直显，错选扣分置灰可重选
 * - 进阶模式：10 题、限时 ×0.6，错一题或超时即出局得 0，全对总分 ×2
 *
 * 每题重答机制：首次作答 + 2 次重答 = 共 3 次机会；每次答错剩余时间 +5 秒；第 3 次答错直接判错过题。
 */
private let RETRY_LIMIT = 2
private let RETRY_BONUS_SEC: Double = 5

private enum Phase {
    case answering, feedback, done, failed
}

private struct AnswerRecord {
    let correct: Bool
    let timedOut: Bool
    let delta: Int
    let timeUsedSec: Double
    let wrongAttempts: Int
}

struct QuizRunnerView: View {
    let skill: Skill
    let mode: QuizMode
    var popToRoot: () -> Void = {}
    var navigate: (AppRoute) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss

    private var params: (count: Int, timeLimitSec: Int) { modeParams(skill, mode) }
    private var advanced: Bool { mode == .advanced }
    private var reviewMode: Bool { mode == .review }

    @State private var questions: [Question] = []
    @State private var index = 0
    @State private var phase: Phase = .answering
    @State private var streak = 0
    @State private var earned = 0
    @State private var records: [AnswerRecord] = []
    @State private var timeLeft: Double = 0
    @State private var pickedId: String? = nil
    @State private var lastDelta = 0
    @State private var lastBreakdown: [String] = []
    @State private var wrongIds: [String] = []
    @State private var attempts = 0
    @State private var input = ""
    @State private var startDate = Date()
    @State private var slotMap: [String: Int] = [:]
    @State private var banked = false

    @State private var advanceWork: DispatchWorkItem?
    @State private var autoSubmitWork: DispatchWorkItem?

    private let ticker = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    private var q: Question? { questions.indices.contains(index) ? questions[index] : nil }
    private var timeLimit: Double { Double(params.timeLimitSec) }

    var body: some View {
        Group {
            if phase == .done {
                doneView
            } else if phase == .failed {
                failedView
            } else if q != nil {
                quizView
            } else {
                Text("知识点不存在").foregroundColor(.slate400)
            }
        }
        .navigationBarHidden(true)
        .background(
            LinearGradient(colors: phase == .failed ? [.red50, .white] : [.indigo50, .white], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        )
        .onAppear { SoundPlayer.warmup(); startRun() }
        .onDisappear {
            advanceWork?.cancel()
            autoSubmitWork?.cancel()
        }
        .onReceive(ticker) { _ in
            guard phase == .answering, q != nil else { return }
            let elapsed = Date().timeIntervalSince(startDate)
            let left = timeLimit - elapsed
            timeLeft = max(0, left)
            if left <= 0 {
                if advanced { failRun(nil) } else { settle(nil, attempts) }
            }
        }
        .onChange(of: input) { _ in scheduleAutoSubmit() }
    }

    /* ---------------- 生命周期 ---------------- */

    private func startRun() {
        questions = generateQuiz(skill, count: params.count)
        index = 0
        phase = .answering
        streak = 0
        earned = 0
        records = []
        pickedId = nil
        lastBreakdown = []
        wrongIds = []
        attempts = 0
        input = ""
        banked = false
        startDate = Date()
        timeLeft = timeLimit
        computeSlots()
    }

    private func computeSlots() {
        guard let q else { slotMap = [:]; return }
        let slots = Array(0..<q.choices.count).shuffled()
        var map: [String: Int] = [:]
        for (i, c) in q.choices.enumerated() { map[c.id] = slots[i] }
        slotMap = map
    }

    /* ---------------- 结算 ---------------- */

    private func settle(_ choiceId: String?, _ attemptCount: Int) {
        guard let q else { return }
        let timedOut = choiceId == nil
        let elapsed = Date().timeIntervalSince(startDate)
        let choice = q.choices.first { $0.id == choiceId }
        let result = scoreAnswer(ScoreInput(
            mode: mode,
            correct: choice?.correct ?? false,
            timeLeftSec: max(0, timeLimit - elapsed),
            timeLimitSec: timeLimit,
            streak: streak,
            timedOut: timedOut,
            wrongAttempts: attemptCount
        ))
        pickedId = choiceId
        lastDelta = result.delta
        lastBreakdown = result.breakdown
        streak = result.newStreak
        earned += result.delta
        SoundPlayer.play((choice?.correct ?? false) ? "correct" : "wrong")
        records.append(AnswerRecord(
            correct: choice?.correct ?? false,
            timedOut: timedOut,
            delta: result.delta,
            timeUsedSec: elapsed,
            wrongAttempts: attemptCount
        ))
        phase = .feedback
        let work = DispatchWorkItem { advance() }
        advanceWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: work)
    }

    private func advance() {
        if index + 1 >= questions.count {
            phase = .done
            finalizeIfNeeded() // 积分在结算页一次性入账
            if records.allSatisfy({ $0.correct }) { SoundPlayer.play("perfect") }
        } else {
            index += 1
            pickedId = nil
            wrongIds = []
            attempts = 0
            input = ""
            startDate = Date()
            phase = .answering
            computeSlots()
        }
    }

    /** 闯关模式错选：扣分、+5 秒补偿、置灰、继续作答；第 3 次错直接判错过题 */
    private func pickWrong(_ c: Choice) {
        let penalty = ScoreRules.wrongPickPenalty
        let used = attempts + 1
        if used > RETRY_LIMIT {
            settle(c.id, used)
            return
        }
        startDate = startDate.addingTimeInterval(RETRY_BONUS_SEC)
        attempts = used
        wrongIds.append(c.id)
        earned += penalty
        streak = 0
        lastDelta = penalty
        SoundPlayer.play("wrong")
        lastBreakdown = [
            "选错 \(penalty) · +\(Int(RETRY_BONUS_SEC))s",
            c.trap ?? "再想一想",
            "还剩 \(RETRY_LIMIT - used + 1) 次机会",
        ]
    }

    /** 进阶模式：错选/超时 → 本局结束 */
    private func failRun(_ choiceId: String?) {
        pickedId = choiceId
        phase = .failed
        SoundPlayer.play("wrong")
        finalizeIfNeeded()
    }

    private func onChoice(_ c: Choice) {
        guard phase == .answering, !wrongIds.contains(c.id) else { return }
        if advanced {
            if c.correct { settle(c.id, 0) } else { failRun(c.id) }
            return
        }
        if c.correct { settle(c.id, attempts) } else { pickWrong(c) }
    }

    /* ---------------- 复习模式：填空提交 ---------------- */

    /** 填错统一处理：扣分 + 剩余时间 +5 秒 + 清空重输；第 3 次错直接判错过题 */
    private func wrongSubmit(_ msg: String) {
        guard let q else { return }
        let used = attempts + 1
        let penalty = ScoreRules.reviewWrongPenalty
        if used > RETRY_LIMIT {
            let wrongChoice = q.choices.first { !$0.correct }!
            settle(wrongChoice.id, used)
            return
        }
        startDate = startDate.addingTimeInterval(RETRY_BONUS_SEC)
        attempts = used
        earned += penalty
        streak = 0
        lastDelta = penalty
        SoundPlayer.play("wrong")
        lastBreakdown = [msg, "填错 \(penalty) · +\(Int(RETRY_BONUS_SEC))s", "还剩 \(RETRY_LIMIT - used + 1) 次机会"]
        input = "" // 答错自动清空，直接重输
    }

    private func submitInput() {
        guard phase == .answering, let q else { return }
        guard let parsed = parseAnswerInput(input) else {
            lastDelta = 0
            lastBreakdown = ["格式不对：整数、小数、3/4 或 1 1/2（带分数用空格隔开）"]
            return
        }
        let correct = q.choices.first { $0.correct }!
        let correctVal = exprValue(correct.value)
        if abs(parsed.value - correctVal) < 1e-9 {
            if let ferr = formError(parsed, correct: correct.value, acceptImproper: skill.acceptImproper, allowUnreduced: skill.allowUnreduced) {
                wrongSubmit(ferr)
                return
            }
            settle(correct.id, attempts)
        } else {
            wrongSubmit("不对，再算一遍")
        }
    }

    /** 数字键盘按键约束：同一串里小数点/分数线/带分数空格各最多一个，且互相排斥 */
    private func pressKey(_ k: String) {
        guard phase == .answering else { return }
        var s = input
        if k == "back" {
            s = String(s.dropLast())
        } else if s.count >= 9 {
            // 已达长度上限，忽略
        } else if k.range(of: #"^\d$"#, options: .regularExpression) != nil {
            s += k
        } else if k == "-" {
            if s.isEmpty { s = "-" } // 负号只能在最前
        } else if k == "." {
            if !s.isEmpty && s != "-" && !s.contains(where: { "./ ".contains($0) }) { s += "." }
        } else if k == "/" {
            if !s.isEmpty && s != "-" && !s.contains("/") && !s.contains(".") && !s.hasSuffix(" ") { s += "/" }
        } else if k == " " {
            if !s.isEmpty && s != "-" && !s.contains(where: { "./ ".contains($0) }) { s += " " }
        }
        input = s
    }

    /** 复习模式：答对自动提交——结构完整 + 数值正确 + 形式合规 + 600ms 无新按键（纯整数不自动提交） */
    private func scheduleAutoSubmit() {
        autoSubmitWork?.cancel()
        guard reviewMode, phase == .answering, let q else { return }
        guard !input.isEmpty, input.contains(where: { "/. ".contains($0) }) else { return }
        guard let parsed = parseAnswerInput(input) else { return }
        let correct = q.choices.first { $0.correct }!
        guard abs(parsed.value - exprValue(correct.value)) < 1e-9 else { return }
        guard formError(parsed, correct: correct.value, acceptImproper: skill.acceptImproper, allowUnreduced: skill.allowUnreduced) == nil else { return }
        let work = DispatchWorkItem { submitInput() }
        autoSubmitWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6, execute: work)
    }

    /* ---------------- 结束入账 ---------------- */

    private var finalEarned: Int {
        advanced ? earned * ScoreRules.advancedMultiplier : earned
    }

    private func finalizeIfNeeded() {
        guard (phase == .done || phase == .failed), !banked else { return }
        banked = true
        let finalScore = phase == .failed ? 0 : finalEarned
        if finalScore != 0 { WalletStore.shared.addPoints(finalScore) }
        StudyLogStore.shared.logSession(
            skillId: skill.id,
            skillTitle: skill.title,
            mode: mode,
            correct: records.filter { $0.correct }.count,
            total: records.count,
            earned: finalScore,
            durationSec: records.reduce(0) { $0 + $1.timeUsedSec }
        )
    }

    /* ---------------- 结算页 ---------------- */

    private var doneView: some View {
        let correctCount = records.filter { $0.correct }.count
        let firstTryCount = records.filter { $0.correct && $0.wrongAttempts == 0 }.count
        let avgTime = records.isEmpty ? 0 : records.reduce(0) { $0 + $1.timeUsedSec } / Double(records.count)
        return VStack(spacing: 24) {
            Spacer()
            Text(advanced ? "🏆" : "🎉")
                .font(.system(size: 60))
            Text(advanced ? "全对通关，积分翻倍！" : "挑战完成！")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.slate800)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                StatCell(label: advanced ? "获得积分（×\(ScoreRules.advancedMultiplier)）" : "获得积分",
                         value: "\(finalEarned >= 0 ? "+" : "")\(finalEarned)", highlight: true)
                StatCell(label: "答对", value: "\(correctCount)/\(records.count)")
                StatCell(label: "一次就对", value: "\(firstTryCount)/\(records.count)")
                StatCell(label: "平均用时", value: String(format: "%.1fs", avgTime))
            }
            .padding(24)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
            .padding(.horizontal, 24)
            HStack(spacing: 12) {
                Button { startRun() } label: {
                    Text("再来一局")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(Color.indigo600)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(color: .indigo100, radius: 8, y: 4)
                }
                Button { popToRoot() } label: {
                    Text("返回首页")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.slate700)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(Color.white)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.slate200))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }
            .padding(.horizontal, 24)
            Spacer()
        }
    }

    /* ---------------- 进阶失败页 ---------------- */

    private var failedView: some View {
        let correct = q?.choices.first { $0.correct }
        let picked = q?.choices.first { $0.id == pickedId }
        return VStack(spacing: 24) {
            Spacer()
            Text("💥")
                .font(.system(size: 60))
            Text("倒在了第 \(index + 1) 题")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.slate800)
            Text("进阶模式一错归零，本局不得分")
                .foregroundColor(.slate500)
            VStack(spacing: 12) {
                Text("正确答案")
                    .font(.system(size: 14))
                    .foregroundColor(.slate400)
                if let correct {
                    MathExprView(expr: correct.value, fontSize: 36, color: .emerald600)
                }
                if let trap = picked?.trap {
                    Text("💡 \(trap)")
                        .font(.system(size: 14))
                        .foregroundColor(.red500)
                }
                if pickedId == nil {
                    Text("⏰ 超时也算错哦")
                        .font(.system(size: 14))
                        .foregroundColor(.red500)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
            .padding(.horizontal, 24)
            HStack(spacing: 12) {
                Button { navigate(.quiz(skill.id, .normal)) } label: {
                    Text("回闯关模式练习")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(Color.indigo600)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(color: .indigo100, radius: 8, y: 4)
                }
                Button { popToRoot() } label: {
                    Text("返回首页")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.slate700)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(Color.white)
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.slate200))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }
            .padding(.horizontal, 24)
            Spacer()
        }
    }

    /* ---------------- 答题主界面 ---------------- */

    private var quizView: some View {
        let pct = min(1, timeLeft / timeLimit) // +5s 补偿可能超出 100%，进度条截断
        let urgent = timeLeft <= 3
        return VStack(spacing: 0) {
            // 顶栏：退出 / 进度 / 模式 / 连对 / 得分
            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.slate700)
                        .padding(8)
                }
                Text("\(index + 1) / \(questions.count)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.slate500)
                Text(modeLabel)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(reviewMode ? .emerald600 : advanced ? .red600 : .indigo600)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(reviewMode ? Color.emerald100 : advanced ? Color.red100 : Color.indigo100)
                    .clipShape(Capsule())
                Spacer()
                if streak >= 2 {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                            .font(.system(size: 13))
                        Text("\(streak) 连对")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundColor(.orange)
                }
                Text("\(earned) 分")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.indigo600)
                    .monospacedDigit()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            // 倒数进度条
            VStack(spacing: 4) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.slate200)
                        Capsule()
                            .fill(urgent ? Color.red500 : Color.indigo600)
                            .frame(width: geo.size.width * pct)
                            .animation(.linear(duration: 0.1), value: pct)
                    }
                }
                .frame(height: 12)
                HStack {
                    Spacer()
                    Text("\(Int(ceil(timeLeft)))s")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(urgent ? .red500 : .slate400)
                        .monospacedDigit()
                }
            }
            .padding(.horizontal, 16)

            // 题面 + 作答区
            ScrollView {
                VStack(spacing: 12) {
                    if let q, !q.requirement.isEmpty {
                        Text(q.requirement)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(.slate500)
                    }
                    if let q {
                        FitMathExpr(expr: q.prompt, fontSize: 44)
                            .frame(height: 110)
                        if !reviewMode {
                            Text("= ?")
                                .font(.system(size: 20))
                                .foregroundColor(.slate400)
                        }
                    }

                    // 复习模式：填空显示框
                    if reviewMode {
                        ZStack(alignment: .topTrailing) {
                            InputPreviewView(input: input)
                                .frame(maxWidth: .infinity, minHeight: 72)
                                .padding(.horizontal, 24)
                                .background(attempts > 0 ? Color.red50 : Color.white)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 24)
                                        .stroke(attempts > 0 ? Color.red300 : Color.emerald300, lineWidth: 3)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 24))
                            if !input.isEmpty && phase == .answering {
                                Button { input = "" } label: {
                                    Text("✕")
                                        .font(.system(size: 14, weight: .black))
                                        .foregroundColor(.white)
                                        .frame(width: 36, height: 36)
                                        .background(Color.slate500)
                                        .clipShape(Circle())
                                        .shadow(radius: 3)
                                }
                                .offset(x: 12, y: -12)
                            }
                        }
                        .padding(.horizontal, 24)
                    }

                    // 即时反馈条
                    if (phase == .feedback || attempts > 0) && !lastBreakdown.isEmpty {
                        Text(lastBreakdown.joined(separator: " · "))
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(lastDelta > 0 ? .emerald700 : lastDelta < 0 ? .red600 : .slate500)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(lastDelta > 0 ? Color.emerald100 : lastDelta < 0 ? Color.red100 : Color.slate100)
                            .clipShape(Capsule())
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 16)
                    }
                }
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: .infinity)

            // 作答区：复习 = 数字键盘；闯关/进阶 = 4 选项
            if reviewMode {
                keypadView
            } else {
                choicesView
            }
        }
    }

    private var modeLabel: String {
        let base = reviewMode ? "📝 复习" : advanced ? "⚡ 进阶" : "🎯 闯关"
        return advanced ? "\(base) ×\(ScoreRules.advancedMultiplier) · 一错归零" : base
    }

    /** 闯关/进阶：固定 4 选项（格子位置每题随机一次），错项置灰 */
    private var choicesView: some View {
        let sorted = (q?.choices ?? []).sorted { (slotMap[$0.id] ?? 0) < (slotMap[$1.id] ?? 0) }
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(sorted, id: \.id) { c in
                let isWrongPicked = wrongIds.contains(c.id)
                Button { onChoice(c) } label: {
                    VStack(spacing: 4) {
                        FitMathExpr(
                            expr: c.value,
                            fontSize: 28,
                            color: choiceTextColor(c, isWrongPicked: isWrongPicked)
                        )
                        .frame(height: 40)
                        if isWrongPicked, let trap = c.trap {
                            Text(trap)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.slate400)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                        } else if phase == .feedback, c.id == pickedId, !c.correct, let trap = c.trap {
                            Text(trap)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.white.opacity(0.9))
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 64)
                    .padding(.vertical, 6)
                    .background(choiceBg(c, isWrongPicked: isWrongPicked))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(choiceBorder(c, isWrongPicked: isWrongPicked), lineWidth: 2)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
                .disabled(phase != .answering || isWrongPicked)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 16)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
    }

    private func choiceBg(_ c: Choice, isWrongPicked: Bool) -> Color {
        if phase == .feedback {
            if c.correct { return .emerald500 }
            if isWrongPicked || c.id == pickedId { return .red500 }
            return .white
        }
        return isWrongPicked ? .slate100 : .white
    }

    private func choiceBorder(_ c: Choice, isWrongPicked: Bool) -> Color {
        if phase == .feedback {
            if c.correct { return .emerald500 }
            if isWrongPicked || c.id == pickedId { return .red500 }
            return .slate200
        }
        return .slate200
    }

    private func choiceTextColor(_ c: Choice, isWrongPicked: Bool) -> Color {
        if phase == .feedback {
            if c.correct || isWrongPicked || c.id == pickedId { return .white }
            return .slate300
        }
        return isWrongPicked ? .slate400 : .slate800
    }

    /** 复习模式数字键盘：按题库裁剪按键（numericKeypad 去掉分数线/带分数） */
    private var keypadView: some View {
        var extras: [(id: String, label: String, sub: String?)] = []
        if skill.allowNegative { extras.append(("-", "−", "负号")) }
        if !skill.numericKeypad {
            if !skill.hideMixedKey { extras.append((" ", "1 ␣ ½", "带分数")) }
            extras.append(("/", "3/4", "分数线"))
        }
        let submitSpan = extras.count == 3 ? 3 : 3 - extras.count
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(["1", "2", "3", "4", "5", "6", "7", "8", "9"], id: \.self) { k in
                KeyButton(label: k) { pressKey(k) }
            }
            KeyButton(label: "0") { pressKey("0") }
            KeyButton(label: ".", sub: "小数点") { pressKey(".") }
            KeyButton(label: "⌫") { pressKey("back") }
            ForEach(extras, id: \.id) { e in
                KeyButton(label: e.label, sub: e.sub, small: true) { pressKey(e.id) }
            }
            Button { submitInput() } label: {
                Text("✓")
                    .font(.system(size: 24, weight: .black))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.emerald600)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .emerald100, radius: 6, y: 3)
            }
            .buttonStyle(.plain)
            .gridCellColumns(submitSpan)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 16)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
    }
}

/* ---------------- 子组件 ---------------- */

private struct StatCell: View {
    let label: String
    let value: String
    var highlight = false

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 24, weight: .black))
                .foregroundColor(highlight ? .indigo600 : .slate800)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 12))
                .foregroundColor(.slate400)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.slate50)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct KeyButton: View {
    let label: String
    var sub: String? = nil
    var small = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Text(label)
                    .font(.system(size: small ? 18 : 26, weight: .black))
                    .foregroundColor(.slate800)
                if let sub {
                    Text(sub)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.slate400)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.slate200, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }
}

/** 幽灵占位槽：分数结构里还没填的位置 */
private struct GhostSlot: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 3)
            .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4]))
            .foregroundColor(.slate300)
            .background(Color.slate50.clipShape(RoundedRectangle(cornerRadius: 3)))
            .frame(width: 16, height: 24)
    }
}

/** 分数槽位渲染：与 MathExprView 同款排版，空位显示幽灵框 */
private struct FracSlots: View {
    let n: String?
    let d: String?

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if let n { Text(n) } else { GhostSlot() }
            }
            .font(.system(size: 22, weight: .bold))
            .padding(.horizontal, 4)
            .padding(.bottom, 2)
            .overlay(alignment: .bottom) {
                Rectangle().frame(height: 2).foregroundColor(.slate800)
            }
            Group {
                if let d { Text(d) } else { GhostSlot() }
            }
            .font(.system(size: 22, weight: .bold))
            .padding(.horizontal, 4)
            .padding(.top, 2)
        }
    }
}

/** 填空输入实时预览：按下带分数/分数线键立即显示结构骨架 */
private struct InputPreviewView: View {
    let input: String

    var body: some View {
        Group {
            if input.isEmpty {
                Text("点键盘输入")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.slate300)
            } else if input.contains(" ") {
                let w = String(input.split(separator: " ", omittingEmptySubsequences: false).first ?? "")
                let rest = input.contains(" ") ? String(input.split(separator: " ", omittingEmptySubsequences: false)[1...].joined(separator: " ")) : ""
                let n = String(rest.split(separator: "/", omittingEmptySubsequences: false).first ?? "")
                let hasSlash = rest.contains("/")
                let d = hasSlash ? String(rest.split(separator: "/", omittingEmptySubsequences: false).dropFirst().joined(separator: "/")) : ""
                HStack(alignment: .center, spacing: 6) {
                    Text(w)
                        .font(.system(size: 34, weight: .black))
                        .monospacedDigit()
                    FracSlots(n: n.isEmpty ? nil : n, d: hasSlash ? (d.isEmpty ? nil : d) : nil)
                }
            } else if input.contains("/") {
                let parts = input.split(separator: "/", omittingEmptySubsequences: false)
                let n = String(parts.first ?? "")
                let d = parts.count > 1 ? String(parts[1]) : ""
                FracSlots(n: n.isEmpty ? nil : n, d: d.isEmpty ? nil : d)
            } else {
                Text(input)
                    .font(.system(size: 34, weight: .black))
                    .monospacedDigit()
            }
        }
        .foregroundColor(.slate800)
        .padding(.vertical, 12)
    }
}
