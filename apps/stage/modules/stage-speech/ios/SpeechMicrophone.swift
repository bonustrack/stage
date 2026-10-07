@preconcurrency import AVFoundation
import UIKit

@MainActor final class SpeechMicrophone {
  private let engine = AVAudioEngine()
  private var tapped = false
  private var configuration: NSObjectProtocol?
  private var previous: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

  func start(onFailure: @escaping @MainActor (String) -> Void, receive: @escaping @Sendable (AVAudioPCMBuffer) -> Void) throws {
    guard UIApplication.shared.applicationState == .active else {
      throw SpeechFailure(message: "Open Stage to use dictation.")
    }
    let audio = AVAudioSession.sharedInstance()
    previous = (audio.category, audio.mode, audio.categoryOptions)
    do {
      try audio.setCategory(.record, mode: .measurement, options: [.allowBluetooth])
      try audio.setActive(true)
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0, format.channelCount > 0 else {
        throw SpeechFailure(message: "The microphone is unavailable. Stop other audio capture and try again.")
      }
      input.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, _ in receive(buffer) }
      tapped = true
      engine.prepare()
      try engine.start()
      configuration = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
        Task { @MainActor in
          guard self?.tapped == true else { return }
          onFailure("The microphone connection changed. Your draft was kept. Tap the mic to try again.")
        }
      }
    } catch {
      _ = stop()
      throw error
    }
  }

  func stop() -> String? {
    if let configuration { NotificationCenter.default.removeObserver(configuration); self.configuration = nil }
    engine.stop()
    if tapped { engine.inputNode.removeTap(onBus: 0); tapped = false }
    guard let previous else { return nil }
    let audio = AVAudioSession.sharedInstance()
    var restored = true
    do { try audio.setActive(false, options: .notifyOthersOnDeactivation) }
    catch { restored = false }
    do { try audio.setCategory(previous.0, mode: previous.1, options: previous.2) }
    catch { restored = false }
    if restored { self.previous = nil; return nil }
    return "Dictation stopped, but the audio session could not be restored. Try your audio action again."
  }
}

final class SpeechBufferConverter: @unchecked Sendable {
  private var converter: AVAudioConverter?

  func convert(_ input: AVAudioPCMBuffer, to format: AVAudioFormat) throws -> AVAudioPCMBuffer {
    if converter?.inputFormat != input.format || converter?.outputFormat != format {
      converter = AVAudioConverter(from: input.format, to: format)
      converter?.primeMethod = .none
    }
    guard let converter else { throw SpeechFailure(message: "The microphone audio format is not supported.") }
    let frames = AVAudioFrameCount(ceil(Double(input.frameLength) * format.sampleRate / input.format.sampleRate))
    guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: max(frames, 1)) else {
      throw SpeechFailure(message: "Could not prepare microphone audio for dictation.")
    }
    var used = false
    var failure: NSError?
    let status = converter.convert(to: output, error: &failure) { _, state in
      if used { state.pointee = .noDataNow; return nil }
      used = true
      state.pointee = .haveData
      return input
    }
    guard status != .error else { throw SpeechFailure(message: "Could not convert microphone audio for dictation.") }
    return output
  }
}
