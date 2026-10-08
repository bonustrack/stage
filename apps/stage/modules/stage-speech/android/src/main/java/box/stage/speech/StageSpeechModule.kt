package box.stage.speech

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StageSpeechModule : Module() {
  private val handler = Handler(Looper.getMainLooper())
  private var support: SpeechSupport? = null
  private var session: SpeechSession? = null
  private var foreground = true

  private fun speechSupport(): SpeechSupport {
    return support ?: SpeechSupport(appContext.reactContext ?: error("Speech context unavailable")).also { support = it }
  }

  override fun definition() = ModuleDefinition {
    Name("StageSpeech")
    Events("onSpeech")

    AsyncFunction("availability") { promise: Promise ->
      speechSupport().check { promise.resolve(it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("requestPermission") {
      val context = appContext.reactContext ?: error("Speech context unavailable")
      speechSupport().languages.reset()
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("downloadModel") {
      speechSupport().download()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("start") { id: String ->
      check(foreground && appContext.currentActivity != null) { "Open Stage to use dictation." }
      check(session == null) { "Another dictation session is active." }
      check(Build.VERSION.SDK_INT >= 31 && speechSupport().available()) { "On-device dictation is unavailable." }
      val context = appContext.reactContext ?: error("Speech context unavailable")
      check(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { "Microphone permission required." }
      val next = SpeechSession(context, id, speechSupport().languages, { sendEvent("onSpeech", it) }, { session = null })
      session = next
      try { next.start() } catch (error: Exception) {
        next.cancel("Could not start on-device dictation. Check microphone access and try again. Your draft was kept.")
        throw error
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") { id: String ->
      session?.takeIf { it.id == id }?.stop()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cancel") { id: String ->
      session?.takeIf { it.id == id }?.cancel()
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground { handler.post { foreground = true } }
    OnActivityEntersBackground { handler.post { foreground = false; session?.cancel() } }
    OnDestroy {
      handler.post { session?.cancel(); support?.destroy(); support = null }
    }
  }
}
