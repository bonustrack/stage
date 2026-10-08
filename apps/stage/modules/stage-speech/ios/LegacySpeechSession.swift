import AVFoundation
@preconcurrency import Speech

@MainActor final class LegacySpeechSession: NativeSpeechSession {
  private let recognizer: SFSpeechRecognizer
  private let request = SFSpeechAudioBufferRecognitionRequest()
  private let microphone = SpeechMicrophone()
  private let result: (String) -> Void
  private let end: (String?) -> Void
  private var task: SFSpeechRecognitionTask?
  private var cancelled = false
  private var stopping = false
  private var timeout: Task<Void, Never>?

  init(locale: Locale, result: @escaping (String) -> Void, end: @escaping (String?) -> Void) throws {
    guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
      throw SpeechFailure(message: "On-device dictation is unavailable for this device language. Type or use + to record voice.")
    }
    self.recognizer = recognizer
    self.result = result
    self.end = end
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = true
    request.taskHint = .dictation
  }

  func start() async throws {
    guard !cancelled else { return }
    guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
      throw SpeechFailure(message: "Allow speech recognition access in Settings to use dictation.")
    }
    task = recognizer.recognitionTask(with: request) { [weak self] transcription, error in
      Task { @MainActor in
        guard let self, !self.cancelled else { return }
        if let transcription { self.result(transcription.bestTranscription.formattedString) }
        if let error {
          let failure = error as NSError
          if failure.domain == "kAFAssistantErrorDomain", failure.code == 1110 { self.end(nil) }
          else { self.end("On-device dictation stopped. Your draft was kept. Tap the mic to try again.") }
        } else if transcription?.isFinal == true { self.end(nil) }
      }
    }
    let request = self.request
    try microphone.start(onFailure: end) { request.append($0) }
  }

  func stop() async {
    guard !cancelled, !stopping else { return }
    stopping = true
    if let error = microphone.stop() { end(error); return }
    request.endAudio()
    timeout = Task { [weak self] in
      do { try await Task.sleep(nanoseconds: 5_000_000_000) }
      catch { return }
      self?.end("Dictation could not finish. Check your draft and tap the mic to try again.")
    }
  }

  func cancel() async -> String? {
    guard !cancelled else { return microphone.stop() }
    cancelled = true
    timeout?.cancel()
    let error = microphone.stop()
    request.endAudio()
    task?.cancel()
    task = nil
    return error
  }
}
