import AVFoundation
import Speech

struct SpeechFailure: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

@MainActor protocol NativeSpeechSession: AnyObject {
  func start() async throws
  func stop() async
  func cancel() async -> String?
}

@MainActor final class SpeechController {
  private let emit: ([String: Any]) -> Void
  private var session: NativeSpeechSession?
  private var sessionId: String?
  private var timer: Task<Void, Never>?
  private var interruption: NSObjectProtocol?

  init(emit: @escaping ([String: Any]) -> Void) {
    self.emit = emit
    interruption = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
      let began = (notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue
      if began { Task { @MainActor in await self?.cancelCurrent() } }
    }
  }

  deinit {
    if let interruption { NotificationCenter.default.removeObserver(interruption) }
  }

  func availability() async -> [String: Any] {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *), let locale = await modernLocale() {
      let installed = await SpeechTranscriber.installedLocales
      let ready = installed.contains { $0.identifier == locale.identifier }
      return ["available": ready, "download": !ready, "locale": locale.identifier]
    }
    #endif
    let recognizer = SFSpeechRecognizer(locale: Locale.current)
    let ready = recognizer?.supportsOnDeviceRecognition == true && recognizer?.isAvailable == true
    return ["available": ready, "download": false, "locale": Locale.current.identifier,
      "reason": "On-device dictation is unavailable for this device language. Type or use + to record voice."]
  }

  func requestPermission() async -> Bool {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *), await modernLocale() != nil { return true }
    #endif
    return await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in continuation.resume(returning: status == .authorized) }
    }
  }

  func downloadModel() async throws {
    #if compiler(>=6.2)
    if #available(iOS 26.0, *), let locale = await modernLocale() {
      let transcriber = ModernSpeechSession.transcriber(locale)
      if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
        try await request.downloadAndInstall()
      }
      return
    }
    #endif
    throw SpeechFailure(message: "No on-device speech model download is available for this language.")
  }

  func start(_ id: String) async throws {
    guard sessionId == nil else { throw SpeechFailure(message: "Another dictation session is active.") }
    guard AVAudioSession.sharedInstance().recordPermission == .granted else {
      throw SpeechFailure(message: "Allow microphone access in Settings to use dictation.")
    }
    sessionId = id
    do {
      let next = try await makeSession(id)
      guard sessionId == id else { _ = await next.cancel(); return }
      session = next
      try await next.start()
      guard sessionId == id else { _ = await next.cancel(); return }
      emit(["sessionId": id, "state": "listening"])
      timer = Task { [weak self] in
        do { try await Task.sleep(nanoseconds: 60_000_000_000) }
        catch { return }
        await self?.stop(id)
      }
    } catch {
      _ = await finish(id, error: nil)
      throw error
    }
  }

  private func makeSession(_ id: String) async throws -> NativeSpeechSession {
    let result: (String) -> Void = { [weak self] text in
      guard let self, self.sessionId == id else { return }
      self.emit(["sessionId": id, "text": text])
    }
    let end: (String?) -> Void = { [weak self] error in
      Task { @MainActor in await self?.finish(id, error: error) }
    }
    #if compiler(>=6.2)
    if #available(iOS 26.0, *), let locale = await modernLocale() {
      let installed = await SpeechTranscriber.installedLocales
      guard installed.contains(where: { $0.identifier == locale.identifier }) else {
        throw SpeechFailure(message: "Download the on-device speech model before dictating.")
      }
      return ModernSpeechSession(locale: locale, result: result, end: end)
    }
    #endif
    return try LegacySpeechSession(locale: Locale.current, result: result, end: end)
  }

  func stop(_ id: String) async {
    guard sessionId == id, let session else { _ = await finish(id, error: nil); return }
    timer?.cancel()
    emit(["sessionId": id, "state": "finishing"])
    await session.stop()
  }

  func cancel(_ id: String) async throws {
    if let error = await finish(id, error: nil) { throw SpeechFailure(message: error) }
  }

  func cancelCurrent() async {
    if let sessionId { _ = await finish(sessionId, error: nil) }
  }

  private func finish(_ id: String, error: String?) async -> String? {
    guard sessionId == id else { return nil }
    let previous = session
    sessionId = nil
    session = nil
    timer?.cancel()
    timer = nil
    let cleanupError = await previous?.cancel()
    var event: [String: Any] = ["sessionId": id, "state": "ended"]
    if let message = error ?? cleanupError { event["error"] = message }
    emit(event)
    return cleanupError
  }

  #if compiler(>=6.2)
  @available(iOS 26.0, *)
  private func modernLocale() async -> Locale? {
    guard SpeechTranscriber.isAvailable else { return nil }
    return await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current)
  }
  #endif
}
