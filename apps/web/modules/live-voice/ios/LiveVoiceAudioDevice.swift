import AVFoundation
import WebRTC

/// **WebRTC's audio, played and recorded by us** — an `RTCAudioDevice` on `AVAudioEngine`.
///
/// WebRTC's own iOS audio device opens the microphone input even to only play: a follower who
/// listens would be asked for the microphone in the reader's words and see the orange dot, and
/// the voice could never run under `.playback`. With this one:
///
/// - **Playout** is an `AVAudioSourceNode` that pulls WebRTC's samples (`getPlayoutData`) into the
///   engine's mixer — under whatever category the session has, `.playback` for a listener.
/// - **Recording** exists only between WebRTC's `initializeRecording`/`startRecording` and
///   `stopRecording`, which it calls only for a track going out — the reader's. Only then is the
///   engine's input touched: an `AVAudioSinkNode` hands the microphone to WebRTC
///   (`deliverRecordedData`) as 16-bit mono.
/// - **The audio session is the module's** (`LiveVoiceModule.applyAudioMode`): a custom device is
///   responsible for it, and WebRTC's `RTCAudioSession` is no longer involved.
///
/// Installed into `react-native-webrtc` (`WebRTCModuleOptions.audioDevice`) before its factory is
/// made — see `LiveVoiceAppDelegateSubscriber`.
final class LiveVoiceAudioDevice: NSObject, RTCAudioDevice {
  static let shared = LiveVoiceAudioDevice()

  /// The playout format WebRTC is given; the engine converts to the hardware's.
  private static let playoutSampleRate: Double = 48_000
  /// Frames one recorded slice may hold — far above any IO buffer the system uses.
  private static let recordCapacity = 16_384

  private let engine = AVAudioEngine()
  private let lock = NSRecursiveLock()
  private let recordBuffer = UnsafeMutablePointer<Int16>.allocate(capacity: LiveVoiceAudioDevice.recordCapacity)

  private var delegate: RTCAudioDeviceDelegate?
  // Taken once from the delegate, so the real-time threads read no Objective-C property.
  private var playoutBlock: RTCAudioDeviceGetPlayoutDataBlock?
  private var recordBlock: RTCAudioDeviceDeliverRecordedDataBlock?
  private var sourceNode: AVAudioSourceNode?
  private var sinkNode: AVAudioSinkNode?
  private var inputSampleRate: Double = 0
  /// A call (or another app) has the audio: the engine waits until it is given back.
  private var isInterrupted = false
  private var configurationObserver: NSObjectProtocol?

  private(set) var isInitialized = false
  private(set) var isPlayoutInitialized = false
  private(set) var isPlaying = false
  private(set) var isRecordingInitialized = false
  private(set) var isRecording = false

  /// Hands this device to `react-native-webrtc`, by name: its options class has no module map to
  /// import. A device set already (by someone else) is left alone.
  static func install() {
    guard let type = NSClassFromString("WebRTCModuleOptions") as? NSObject.Type else {
      return
    }

    let selector = NSSelectorFromString("sharedInstance")

    guard
      type.responds(to: selector),
      let options = type.perform(selector)?.takeUnretainedValue() as? NSObject,
      options.value(forKey: "audioDevice") == nil
    else {
      return
    }

    options.setValue(shared, forKey: "audioDevice")
  }

  // MARK: Parameters

  var deviceInputSampleRate: Double {
    inputSampleRate > 0 ? inputSampleRate : AVAudioSession.sharedInstance().sampleRate
  }

  var inputIOBufferDuration: TimeInterval { AVAudioSession.sharedInstance().ioBufferDuration }
  var inputNumberOfChannels: Int { 1 }
  var inputLatency: TimeInterval { isRecording ? AVAudioSession.sharedInstance().inputLatency : 0 }
  var deviceOutputSampleRate: Double { LiveVoiceAudioDevice.playoutSampleRate }
  var outputIOBufferDuration: TimeInterval { AVAudioSession.sharedInstance().ioBufferDuration }
  var outputNumberOfChannels: Int { 1 }
  var outputLatency: TimeInterval { AVAudioSession.sharedInstance().outputLatency }

  // MARK: Life cycle

  func initialize(with delegate: RTCAudioDeviceDelegate) -> Bool {
    lock.lock()
    defer { lock.unlock() }

    self.delegate = delegate
    playoutBlock = delegate.getPlayoutData
    recordBlock = delegate.deliverRecordedData
    isInitialized = true

    if configurationObserver == nil {
      // A route change re-makes the engine's formats: rebuild on WebRTC's own thread, tell it first.
      configurationObserver = NotificationCenter.default.addObserver(
        forName: .AVAudioEngineConfigurationChange,
        object: engine,
        queue: nil
      ) { [weak self] _ in
        self?.onConfigurationChange()
      }
    }

    return true
  }

  func terminateDevice() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    isPlaying = false
    isRecording = false
    isPlayoutInitialized = false
    isRecordingInitialized = false
    rebuild()
    delegate = nil
    playoutBlock = nil
    recordBlock = nil
    isInitialized = false

    return true
  }

  func initializePlayout() -> Bool {
    isPlayoutInitialized = true
    return true
  }

  func startPlayout() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    isPlaying = true
    rebuild()

    return true
  }

  func stopPlayout() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    isPlaying = false
    rebuild()

    return true
  }

  func initializeRecording() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    // The one place the input is looked at — the reader's microphone, already allowed.
    inputSampleRate = engine.inputNode.outputFormat(forBus: 0).sampleRate
    isRecordingInitialized = true

    return true
  }

  func startRecording() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    isRecording = true
    rebuild()

    return true
  }

  func stopRecording() -> Bool {
    lock.lock()
    defer { lock.unlock() }

    isRecording = false
    isRecordingInitialized = false
    rebuild()

    return true
  }

  // MARK: The module's hold on it

  /// A call took the audio, or gave it back: the engine stops and starts again with it.
  func setInterrupted(_ interrupted: Bool) {
    lock.lock()
    isInterrupted = interrupted
    rebuild()
    lock.unlock()

    if interrupted, let delegate {
      delegate.dispatchAsync {
        delegate.notifyAudioOutputInterrupted()
        delegate.notifyAudioInputInterrupted()
      }
    }
  }

  /// Voice off: the engine stops before the session is let go, which fails while it runs.
  func stopEngine() {
    lock.lock()
    defer { lock.unlock() }

    if engine.isRunning {
      engine.stop()
    }
  }

  // MARK: The engine

  private func onConfigurationChange() {
    guard let delegate else {
      return
    }

    delegate.dispatchAsync { [weak self] in
      guard let self else {
        return
      }

      self.lock.lock()

      if self.isRecordingInitialized {
        self.inputSampleRate = self.engine.inputNode.outputFormat(forBus: 0).sampleRate
      }

      delegate.notifyAudioOutputParametersChange()

      if self.isRecordingInitialized {
        delegate.notifyAudioInputParametersChange()
      }

      self.rebuild()
      self.lock.unlock()
    }
  }

  /// The graph as the state asks for it: the source while playing, the input and sink only while recording.
  private func rebuild() {
    if engine.isRunning {
      engine.stop()
    }

    if let source = sourceNode {
      engine.detach(source)
      sourceNode = nil
    }

    if let sink = sinkNode {
      engine.detach(sink)
      sinkNode = nil
    }

    guard (isPlaying || isRecording) && !isInterrupted else {
      return
    }

    // Always an output, so the engine has something to run; silent unless WebRTC plays.
    let mixer = engine.mainMixerNode

    if isPlaying, let source = makeSourceNode() {
      engine.attach(source)
      engine.connect(
        source,
        to: mixer,
        format: AVAudioFormat(standardFormatWithSampleRate: LiveVoiceAudioDevice.playoutSampleRate, channels: 1)
      )
      sourceNode = source
    }

    if isRecording {
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      let sink = makeSinkNode()

      engine.attach(sink)
      engine.connect(input, to: sink, format: format)
      sinkNode = sink
    }

    engine.prepare()

    do {
      try engine.start()
    } catch {
      // The session is not ready (off, or taken): the next change starts it.
    }
  }

  private func makeSourceNode() -> AVAudioSourceNode? {
    guard
      let format = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: LiveVoiceAudioDevice.playoutSampleRate,
        channels: 1,
        interleaved: true
      )
    else {
      return nil
    }

    return AVAudioSourceNode(format: format) { [weak self] isSilence, timestamp, frameCount, outputData in
      guard let self, self.isPlaying, let playout = self.playoutBlock else {
        LiveVoiceAudioDevice.silence(outputData)
        isSilence.pointee = true
        return noErr
      }

      var flags = AudioUnitRenderActionFlags()

      return playout(&flags, timestamp, 0, frameCount, outputData)
    }
  }

  private func makeSinkNode() -> AVAudioSinkNode {
    AVAudioSinkNode { [weak self] timestamp, frameCount, inputData in
      guard let self, self.isRecording, let record = self.recordBlock else {
        return noErr
      }

      let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inputData))

      guard let first = buffers.first, let data = first.mData else {
        return noErr
      }

      // The first channel, from the engine's floats to WebRTC's 16-bit integers.
      let frames = min(Int(frameCount), LiveVoiceAudioDevice.recordCapacity)
      let samples = data.assumingMemoryBound(to: Float.self)

      for index in 0..<frames {
        recordBuffer[index] = Int16(max(-1, min(1, samples[index])) * Float(Int16.max))
      }

      var list = AudioBufferList(
        mNumberBuffers: 1,
        mBuffers: AudioBuffer(
          mNumberChannels: 1,
          mDataByteSize: UInt32(frames * MemoryLayout<Int16>.size),
          mData: recordBuffer
        )
      )
      var flags = AudioUnitRenderActionFlags()

      return record(&flags, timestamp, 1, UInt32(frames), &list, nil, nil)
    }
  }

  private static func silence(_ outputData: UnsafeMutablePointer<AudioBufferList>) {
    for buffer in UnsafeMutableAudioBufferListPointer(outputData) {
      if let data = buffer.mData {
        memset(data, 0, Int(buffer.mDataByteSize))
      }
    }
  }
}
