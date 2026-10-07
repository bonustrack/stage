import ExpoModulesCore

public class StageSpeechModule: Module {
  private var controller: SpeechController?

  @MainActor private func speech() -> SpeechController {
    if let controller { return controller }
    let controller = SpeechController { [weak self] event in self?.sendEvent("onSpeech", event) }
    self.controller = controller
    return controller
  }

  public func definition() -> ModuleDefinition {
    Name("StageSpeech")
    Events("onSpeech")

    AsyncFunction("availability") { () async -> [String: Any] in
      await self.speech().availability()
    }
    AsyncFunction("requestPermission") { () async -> Bool in
      await self.speech().requestPermission()
    }
    AsyncFunction("downloadModel") { () async throws in
      try await self.speech().downloadModel()
    }
    AsyncFunction("start") { (id: String) async throws in
      try await self.speech().start(id)
    }
    AsyncFunction("stop") { (id: String) async in
      await self.speech().stop(id)
    }
    AsyncFunction("cancel") { (id: String) async throws in
      try await self.speech().cancel(id)
    }
    OnAppEntersBackground {
      Task { @MainActor in await self.controller?.cancelCurrent() }
    }
    OnDestroy {
      Task { @MainActor in
        await self.controller?.cancelCurrent()
        self.controller = nil
      }
    }
  }
}
