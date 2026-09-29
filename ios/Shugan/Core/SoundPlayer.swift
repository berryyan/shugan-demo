import AVFoundation

/**
 * 答题音效播放器：答对 correct / 答错 wrong / 全对通关 perfect。
 * 音频文件在 Resources/Sounds 目录下（mp3），随包打入；预加载避免首次播放延迟。
 * 使用默认音频会话（尊重静音开关）。
 */
enum SoundPlayer {
    private static var players: [String: AVAudioPlayer] = [:]

    /** 预加载全部音效（页面出现时调用一次） */
    static func warmup() {
        for name in ["correct", "wrong", "perfect"] {
            _ = player(for: name)
        }
    }

    static func play(_ name: String) {
        guard let p = player(for: name) else { return }
        p.currentTime = 0
        p.play()
    }

    private static func player(for name: String) -> AVAudioPlayer? {
        if let p = players[name] { return p }
        guard let url = Bundle.main.url(forResource: name, withExtension: "mp3"),
              let p = try? AVAudioPlayer(contentsOf: url) else { return nil }
        p.prepareToPlay()
        players[name] = p
        return p
    }
}
