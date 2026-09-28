import Foundation
import Combine

/**
 * 学习日志 —— 每局快问快答结束时记录一条，供设置页"当日学习记录"给家长查看。
 * UserDefaults 持久化，只保留最近 7 天，手动"重置分数"时清空。与网页版 core/studyLog.ts 一致。
 */

struct StudyEntry: Codable, Equatable {
    var ts: TimeInterval     // 毫秒时间戳
    let skillId: String
    let skillTitle: String
    let mode: String         // review / normal / advanced
    let correct: Int         // 答对题数
    let total: Int           // 总题数
    let earned: Int          // 本局积分（可能为负）
    let durationSec: Double  // 总用时
}

struct DaySummary {
    let sessions: Int
    let totalQ: Int
    let correctQ: Int
    let accuracy: Int        // 百分比
    let earned: Int
    let durationSec: Int
}

final class StudyLogStore: ObservableObject {
    static let shared = StudyLogStore()

    private let key = "shugan.studylog.v1"
    private let keepDays = 7

    @Published private(set) var entries: [StudyEntry]

    private init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let list = try? JSONDecoder().decode([StudyEntry].self, from: data) {
            entries = list
        } else {
            entries = []
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    /** 记录一局 */
    func logSession(skillId: String, skillTitle: String, mode: QuizMode, correct: Int, total: Int, earned: Int, durationSec: Double) {
        let now = Date().timeIntervalSince1970 * 1000
        entries.append(StudyEntry(ts: now, skillId: skillId, skillTitle: skillTitle, mode: mode.rawValue, correct: correct, total: total, earned: earned, durationSec: durationSec))
        // 只保留最近 7 天
        let cutoff = now - Double(keepDays) * 86400_000
        entries = entries.filter { $0.ts >= cutoff }
        save()
    }

    /** 清空（手动重置分数时调用） */
    func clear() {
        entries = []
        save()
    }

    private func sameDay(_ ts: TimeInterval, _ day: Date) -> Bool {
        let cal = Calendar.current
        return cal.isDate(Date(timeIntervalSince1970: ts / 1000), inSameDayAs: day)
    }

    /** 取某一天的记录（默认今天），按时间倒序 */
    func dayLog(_ day: Date = Date()) -> [StudyEntry] {
        entries.filter { sameDay($0.ts, day) }.sorted { $0.ts > $1.ts }
    }

    /** 某日汇总统计 */
    func daySummary(_ day: Date = Date()) -> DaySummary {
        let log = dayLog(day)
        let totalQ = log.reduce(0) { $0 + $1.total }
        let correctQ = log.reduce(0) { $0 + $1.correct }
        return DaySummary(
            sessions: log.count,
            totalQ: totalQ,
            correctQ: correctQ,
            accuracy: totalQ > 0 ? Int((Double(correctQ) / Double(totalQ) * 100).rounded()) : 0,
            earned: log.reduce(0) { $0 + $1.earned },
            durationSec: Int(log.reduce(0.0) { $0 + $1.durationSec }.rounded())
        )
    }
}
