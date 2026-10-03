import AVFoundation
import ExpoModulesCore
import MediaPlayer

/// The lock-screen entry, as `index.ts` describes it. Android's labels are unused here: iOS draws its own play/pause.
struct NowPlayingInfo: Record {
  @Field var role: String = "listening"
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var isPlaying: Bool = false
  @Field var playLabel: String = ""
  @Field var stopLabel: String = ""
  @Field var channelName: String = ""
}

/// Live voice on iOS: the audio session, Now Playing with play/pause, and interruptions.
///
/// **The audio session is ours.** WebRTC plays and records through `LiveVoiceAudioDevice`, which
/// leaves the session to the app: **listening is `.playback`** (spoken audio) — no microphone, no
/// prompt, no orange dot, and it plays on when locked like a podcast; **reading is
/// `.playAndRecord`** on the speaker. The session is activated once on the way in, only re-set
/// between modes, and deactivated once on "off", so other audio resumes.
public class LiveVoiceModule: Module {
  private var commandTargets: [(MPRemoteCommand, Any)] = []
  private var interruptionObserver: NSObjectProtocol?
  private var routeObserver: NSObjectProtocol?
  private var volumeObservation: NSKeyValueObservation?
  private var isPlaying = false
  private var isSessionActive = false

  public func definition() -> ModuleDefinition {
    Name("LiveVoice")

    Events("onCommand", "onInterruption", "onHeadphonesLost", "onVolumeChange")

    OnCreate {
      // The app-delegate subscriber has normally done this already; harmless again.
      LiveVoiceAudioDevice.install()
      self.observeInterruptions()
      self.observeRoute()
      self.observeVolume()
    }

    OnDestroy {
      if let observer = self.interruptionObserver {
        NotificationCenter.default.removeObserver(observer)
      }

      if let observer = self.routeObserver {
        NotificationCenter.default.removeObserver(observer)
      }

      self.volumeObservation?.invalidate()
      try? self.applyAudioMode("off")

      DispatchQueue.main.async {
        self.clearNowPlaying()
      }
    }

    // The ringer switch has no say here: neither `.playback` nor `.playAndRecord` is silenced by it.
    Function("getOutputVolume") { () -> Float in
      AVAudioSession.sharedInstance().outputVolume
    }

    AsyncFunction("setAudioMode") { (mode: String) in
      try self.applyAudioMode(mode)
    }

    AsyncFunction("requestMicrophonePermission") { (promise: Promise) in
      let answer = { (granted: Bool) in
        promise.resolve(["granted": granted, "canAskAgain": false])
      }

      switch AVAudioApplication.shared.recordPermission {
      case .granted:
        answer(true)
      case .denied:
        answer(false)
      default:
        AVAudioApplication.requestRecordPermission { granted in
          answer(granted)
        }
      }
    }

    Function("showNowPlaying") { (info: NowPlayingInfo) in
      DispatchQueue.main.async {
        self.updateNowPlaying(info)
      }
    }

    Function("hideNowPlaying") {
      DispatchQueue.main.async {
        self.clearNowPlaying()
      }
    }
  }

  private func observeInterruptions() {
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard
        let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: raw)
      else {
        return
      }

      LiveVoiceAudioDevice.shared.setInterrupted(type == .began)
      self?.sendEvent("onInterruption", ["isInterrupted": type == .began])
    }
  }

  private func observeVolume() {
    volumeObservation = AVAudioSession.sharedInstance().observe(\.outputVolume) { [weak self] session, _ in
      self?.sendEvent("onVolumeChange", ["volume": session.outputVolume])
    }
  }

  /// Headphones out — wired unplugged, or a Bluetooth set gone: the system would move the voice to
  /// the speaker, and a listener never asked for that.
  private func observeRoute() {
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      guard
        let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
        AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable,
        let previous = notification.userInfo?[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription
      else {
        return
      }

      let headphones: [AVAudioSession.Port] = [
        .headphones, .bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .usbAudio, .carAudio, .airPlay
      ]

      if previous.outputs.contains(where: { headphones.contains($0.portType) }) {
        self?.sendEvent("onHeadphonesLost")
      }
    }
  }

  private func applyAudioMode(_ mode: String) throws {
    let session = AVAudioSession.sharedInstance()

    switch mode {
    case "listening":
      try session.setCategory(.playback, mode: .spokenAudio, options: [])
    case "reading":
      try session.setCategory(
        .playAndRecord,
        mode: .default,
        options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
      )
    default:
      guard isSessionActive else {
        return
      }

      // Stopped first: a session cannot be let go while the engine still runs on it.
      LiveVoiceAudioDevice.shared.stopEngine()
      try? session.setActive(false, options: .notifyOthersOnDeactivation)
      isSessionActive = false
      return
    }

    // Activated once; between listening and reading only the category changes.
    if !isSessionActive {
      try session.setActive(true)
      isSessionActive = true
    }
  }

  private func updateNowPlaying(_ info: NowPlayingInfo) {
    // The reader has the microphone indicator; the lock-screen entry is the listener's.
    if info.role != "listening" {
      clearNowPlaying()
      return
    }

    isPlaying = info.isPlaying
    enableCommands()

    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: info.title,
      MPMediaItemPropertyArtist: info.subtitle,
      MPMediaItemPropertyArtwork: LiveVoiceModule.artwork,
      MPNowPlayingInfoPropertyIsLiveStream: true,
      MPNowPlayingInfoPropertyPlaybackRate: info.isPlaying ? 1.0 : 0.0
    ]
    MPNowPlayingInfoCenter.default().playbackState = info.isPlaying ? .playing : .paused
  }

  /// Play and stop only, as a live stream: no pause (live never resumes where it left off), no
  /// skipping, no position. Headphones' and cars' play/pause button toggles.
  private func enableCommands() {
    guard commandTargets.isEmpty else {
      return
    }

    UIApplication.shared.beginReceivingRemoteControlEvents()

    let center = MPRemoteCommandCenter.shared()

    center.pauseCommand.isEnabled = false
    addCommand(center.playCommand) { _ in "play" }
    addCommand(center.stopCommand) { _ in "pause" }
    addCommand(center.togglePlayPauseCommand) { module in module.isPlaying ? "pause" : "play" }
  }

  /// The design's lock-screen image: the live reading's glyph on the app's green (G1). Drawn once,
  /// in the design's own colours — a native image, outside the app's theme.
  private static let artwork: MPMediaItemArtwork = {
    let side: CGFloat = 512
    let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { context in
      UIColor(red: 0x3E / 255, green: 0x6B / 255, blue: 0x5C / 255, alpha: 1).setFill()
      context.fill(CGRect(x: 0, y: 0, width: side, height: side))

      // The glyph's 24 grid at 54% of the image, centred — 30 of 56 in the design.
      let scale = side * 0.54 / 24
      let offset = (side - 24 * scale) / 2
      let point = { (x: CGFloat, y: CGFloat) in CGPoint(x: offset + x * scale, y: offset + y * scale) }
      let ink = UIColor(red: 0xF2 / 255, green: 0xF0 / 255, blue: 0xEA / 255, alpha: 1)

      let book = UIBezierPath()
      book.move(to: point(12, 11.6))
      book.addCurve(to: point(3.6, 10.2), controlPoint1: point(9.6, 10.2), controlPoint2: point(6.6, 9.8))
      book.addLine(to: point(3.6, 18.6))
      book.addCurve(to: point(12, 20), controlPoint1: point(6.6, 18.2), controlPoint2: point(9.6, 18.6))
      book.addCurve(to: point(20.4, 18.6), controlPoint1: point(14.4, 18.6), controlPoint2: point(17.4, 18.2))
      book.addLine(to: point(20.4, 10.2))
      book.addCurve(to: point(12, 11.6), controlPoint1: point(17.4, 9.8), controlPoint2: point(14.4, 10.2))
      book.close()
      ink.withAlphaComponent(0.22).setFill()
      book.fill()

      let strokes = UIBezierPath()
      strokes.append(book)
      strokes.move(to: point(12, 11.6))
      strokes.addLine(to: point(12, 20))
      // The design's `a3.4 3.4` arcs over a 4.4 chord: centres 2.592 inside the chord, ±0.7036 rad off the horizontal.
      let waveAngle: CGFloat = 0.7036
      strokes.move(to: point(9.2, 3.2))
      strokes.addArc(
        withCenter: point(11.792, 5.4), radius: 3.4 * scale,
        startAngle: -(.pi - waveAngle), endAngle: .pi - waveAngle, clockwise: false)
      strokes.move(to: point(14.8, 3.2))
      strokes.addArc(
        withCenter: point(12.208, 5.4), radius: 3.4 * scale,
        startAngle: -waveAngle, endAngle: waveAngle, clockwise: true)
      strokes.lineWidth = 1.6 * scale
      strokes.lineCapStyle = .round
      strokes.lineJoinStyle = .round
      ink.setStroke()
      strokes.stroke()

      ink.setFill()
      UIBezierPath(arcCenter: point(12, 5.4), radius: 1.6 * scale, startAngle: 0, endAngle: .pi * 2, clockwise: true)
        .fill()
    }

    return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
  }()

  private func addCommand(_ command: MPRemoteCommand, name: @escaping (LiveVoiceModule) -> String) {
    command.isEnabled = true

    let target = command.addTarget { [weak self] _ in
      guard let self else {
        return .commandFailed
      }

      self.sendEvent("onCommand", ["command": name(self)])
      return .success
    }

    commandTargets.append((command, target))
  }

  private func clearNowPlaying() {
    for (command, target) in commandTargets {
      command.removeTarget(target)
      command.isEnabled = false
    }

    if !commandTargets.isEmpty {
      UIApplication.shared.endReceivingRemoteControlEvents()
    }

    commandTargets = []
    MPRemoteCommandCenter.shared().pauseCommand.isEnabled = true
    isPlaying = false
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    MPNowPlayingInfoCenter.default().playbackState = .stopped
  }
}
