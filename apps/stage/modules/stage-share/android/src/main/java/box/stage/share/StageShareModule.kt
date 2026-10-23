package box.stage.share

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StageShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StageShare")
    Events("onShareChanged")

    OnCreate {
      StageShareInbox.changed = { sendEvent("onShareChanged", emptyMap<String, Any>()) }
    }

    OnDestroy {
      StageShareInbox.changed = null
    }

    AsyncFunction("getPending") {
      StageShareInbox.pending()
    }

    AsyncFunction("dismiss") { id: String, keepFiles: Boolean ->
      appContext.reactContext?.let { StageShareInbox.dismiss(it, id, keepFiles) }
    }

  }
}
