package box.stage.calls

import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StageCallsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StageCalls")
    Events("onScreenShare")

    AsyncFunction("start") { video: Boolean ->
      val context = appContext.reactContext ?: throw IllegalStateException("Call context unavailable")
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Microphone permission required")
      }
      if (video && ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Camera permission required")
      }
      val intent = Intent(context, StageCallService::class.java).putExtra("video", video)
      ContextCompat.startForegroundService(context, intent)
      Unit
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      appContext.reactContext?.stopService(Intent(appContext.reactContext, StageCallService::class.java))
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      appContext.reactContext?.stopService(Intent(appContext.reactContext, StageCallService::class.java))
    }
  }
}
