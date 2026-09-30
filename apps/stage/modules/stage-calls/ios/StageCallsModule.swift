import ExpoModulesCore
import CoreFoundation

public class StageCallsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StageCalls")
    Events("onScreenShare")
    AsyncFunction("start") { (_: Bool) in }
    AsyncFunction("stop") { }

    OnCreate {
      self.observe("iOS_BroadcastStarted")
      self.observe("iOS_BroadcastStopped")
    }

    OnDestroy {
      CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(), Unmanaged.passUnretained(self).toOpaque())
    }
  }

  private func observe(_ name: String) {
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      { _, observer, name, _, _ in
        guard let observer, let name else { return }
        let module = Unmanaged<StageCallsModule>.fromOpaque(observer).takeUnretainedValue()
        let started = name.rawValue as String == "iOS_BroadcastStarted"
        module.sendEvent("onScreenShare", ["started": started])
      },
      name as CFString,
      nil,
      .deliverImmediately
    )
  }
}
