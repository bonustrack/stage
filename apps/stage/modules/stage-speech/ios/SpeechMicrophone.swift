@preconcurrency import AVFoundation
import UIKit

@MainActor final class SpeechMicrophone {
  private let engine = AVAudioEngine()
  private var tapped = false
  private var previous: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?

  func start(receive: @escaping @Sendable (AVAudioPCMBuffer) -> Void) throws {
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
    } catch {
      _ = stop()
      throw error
    }
  }

  func stop() -> String? {
    engine.stop()
    if tapped { engine.inputNode.removeTap(onBus: 0); tapped = false }
    guard let previous else { return nil }
    self.previous = nil
    let audio = AVAudioSession.sharedInstance()
    do {
      try audio.setActive(false, options: .notifyOthersOnDeactivation)
      try audio.setCategory(previous.0, mode: previous.1, options: previous.2)
      return nil
    } catch {
      return "Dictation stopped, but the audio session could not be restored. Try your audio action again."
    }
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
