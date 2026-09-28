import SwiftUI

@main
struct ShuganApp: App {
    var body: some Scene {
        WindowGroup {
            RootTabView()
        }
    }
}

/** 根导航：学习 / 设置 两个 tab（游戏厅暂缓，待改造方案定案） */
struct RootTabView: View {
    @State private var selectedTab = 0
    @State private var learnPath = NavigationPath()

    init() {
        // DEBUG 专用：支持 -debugRoute 启动参数直接落到指定页面，便于自动化截图验证
        // 例：-debugRoute quiz:g5s1-add:normal / -debugRoute intro:g5s1-add / -debugRoute settings
        #if DEBUG
        if let route = UserDefaults.standard.string(forKey: "debugRoute") {
            let parts = route.split(separator: ":").map(String.init)
            if parts[0] == "settings" {
                _selectedTab = State(initialValue: 1)
            } else if parts.count >= 2, parts[0] == "intro" {
                var p = NavigationPath()
                p.append(AppRoute.intro(parts[1]))
                _learnPath = State(initialValue: p)
            } else if parts.count >= 3, parts[0] == "quiz", let mode = QuizMode(rawValue: parts[2]) {
                var p = NavigationPath()
                p.append(AppRoute.quiz(parts[1], mode))
                _learnPath = State(initialValue: p)
            }
        }
        #endif
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $learnPath) {
                HomeView()
                    .navigationDestination(for: AppRoute.self) { route in
                        switch route {
                        case .intro(let skillId):
                            if let skill = findSkill(skillId) {
                                QuizIntroView(skill: skill)
                            } else {
                                Text("知识点不存在")
                                    .foregroundColor(.slate400)
                            }
                        case .quiz(let skillId, let mode):
                            if let skill = findSkill(skillId) {
                                QuizRunnerView(
                                    skill: skill,
                                    mode: mode,
                                    popToRoot: { learnPath = NavigationPath() },
                                    navigate: { learnPath.append($0) }
                                )
                            } else {
                                Text("知识点不存在")
                                    .foregroundColor(.slate400)
                            }
                        }
                    }
            }
            .tabItem {
                Label("学习", systemImage: "book.fill")
            }
            .tag(0)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("设置", systemImage: "gearshape.fill")
            }
            .tag(1)
        }
        .tint(.indigo600)
    }
}
