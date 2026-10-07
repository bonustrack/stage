#if compiler(>=6.2)
@preconcurrency import AVFoundation
import Speech

@available(iOS 26.0, *)
@MainActor final class ModernSpeechSession: NativeSpeechSession {
  private let transcriber: SpeechTranscriber
  private let analyzer: SpeechAnalyzer
  private let microphone = SpeechMicrophone()
  private let result: (String) -> Void
  private let end: (String?) -> Void
  private var input: AsyncStream<AnalyzerInput>.Continuation?
  private var results: Task<Void, Never>?
  private var cancelled = false
  private var stopping = false
  private var committed = ""

  static func transcriber(_ locale: Locale) -> SpeechTranscriber {
    SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults], attributeOptions: [])
  }

  init(locale: Locale, result: @escaping (String) -> Void, end: @escaping (String?) -> Void) {
    let transcriber = Self.transcriber(locale)
    self.transcriber = transcriber
    self.analyzer = SpeechAnalyzer(modules: [transcriber])
    self.result = result
    self.end = end
  }

  func start() async throws {
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else {
      throw SpeechFailure(message: "The on-device speech audio format is unavailable.")
    }
    guard !cancelled else { return }
    let (sequence, continuation) = AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy: .bufferingNewest(64))
    input = continuation
    results = Task { [weak self] in
      guard let self else { return }
      do {
        for try await output in self.transcriber.results {
          guard !self.cancelled else { return }
          let text = String(output.text.characters)
          if output.isFinal { self.committed += text; self.result(self.committed) }
          else { self.result(self.committed + text) }
        }
      } catch {
        if !self.cancelled { self.end("On-device dictation stopped. Your draft was kept. Tap the mic to try again.") }
      }
    }
    try await analyzer.prepareToAnalyze(in: format)
    guard !cancelled else { return }
    try await analyzer.start(inputSequence: sequence)
    guard !cancelled else { return }
    let converter = SpeechBufferConverter()
    try microphone.start(onFailure: end) { [weak self] buffer in
      do {
        let converted = try converter.convert(buffer, to: format)
        if converted.frameLength > 0, case .dropped = continuation.yield(AnalyzerInput(buffer: converted)) {
          Task { @MainActor in
            if self?.cancelled == false { self?.end("Dictation could not keep up with the microphone. Your draft was kept.") }
          }
        }
      } catch {
        Task { @MainActor in
          if self?.cancelled == false { self?.end("Could not process microphone audio. Your draft was kept.") }
        }
      }
    }
  }

  func stop() async {
    guard !cancelled, !stopping else { return }
    stopping = true
    if let error = microphone.stop() { end(error); return }
    input?.finish()
    do {
      try await analyzer.finalizeAndFinishThroughEndOfInput()
      await results?.value
      if !cancelled { end(nil) }
    } catch {
      if !cancelled { end("Dictation stopped. Check the text before sending.") }
    }
  }

  func cancel() async -> String? {
    guard !cancelled else { return microphone.stop() }
    cancelled = true
    let error = microphone.stop()
    input?.finish()
    input = nil
    results?.cancel()
    await analyzer.cancelAndFinishNow()
    results = nil
    return error
  }
}
#endif
