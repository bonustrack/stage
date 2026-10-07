package box.stage.speech

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

internal fun speechIntent(): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
  putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
  putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
  putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
  putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
}

internal class SpeechSupport(private val context: Context) {
  private val handler = Handler(Looper.getMainLooper())
  private val probes = mutableSetOf<SpeechRecognizer>()
  private var downloader: SpeechRecognizer? = null

  fun available(): Boolean = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

  private fun result(ready: Boolean, download: Boolean = false, reason: String? = null): Map<String, Any> {
    val value = mutableMapOf<String, Any>("available" to ready, "download" to download, "locale" to Locale.getDefault().toLanguageTag())
    if (reason != null) value["reason"] = reason
    return value
  }

  fun check(done: (Map<String, Any>) -> Unit) {
    if (!available()) {
      done(result(false, reason = "On-device dictation needs Android 12 or later and an installed on-device speech service. Use typing or + to record voice."))
      return
    }
    if (Build.VERSION.SDK_INT < 33) { done(result(true)); return }
    val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
    probes.add(recognizer)
    var finished = false
    lateinit var timeout: Runnable
    fun finish(value: Map<String, Any>) {
      if (finished) return
      finished = true
      handler.removeCallbacks(timeout)
      probes.remove(recognizer)
      recognizer.destroy()
      done(value)
    }
    timeout = Runnable { finish(result(true)) }
    handler.postDelayed(timeout, 5000)
    try {
      recognizer.checkRecognitionSupport(speechIntent(), context.mainExecutor, object : RecognitionSupportCallback {
        override fun onSupportResult(support: RecognitionSupport) {
          val locale = Locale.getDefault().toLanguageTag()
          fun matches(languages: List<String>) = languages.any { it.equals(locale, ignoreCase = true) }
          val installed = support.installedOnDeviceLanguages
          val pending = support.pendingOnDeviceLanguages
          val supported = support.supportedOnDeviceLanguages
          when {
            matches(installed) -> finish(result(true))
            matches(pending) -> finish(result(false, reason = "The speech model is still downloading. Try the mic again later, or use + to record voice."))
            matches(supported) -> finish(result(false, download = true))
            installed.isEmpty() && pending.isEmpty() && supported.isEmpty() -> finish(result(true))
            else -> finish(result(false, reason = "On-device dictation is unavailable for $locale. Change the device language, type, or use + to record voice."))
          }
        }
        override fun onError(error: Int) { finish(result(true)) }
      })
    } catch (error: Exception) {
      finish(result(false, reason = "The on-device speech service could not be checked. Try again or use + to record voice."))
    }
  }

  fun download() {
    check(Build.VERSION.SDK_INT >= 33 && available()) { "Install the speech language model in your device's speech settings." }
    val recognizer = downloader ?: SpeechRecognizer.createOnDeviceSpeechRecognizer(context).also { downloader = it }
    recognizer.triggerModelDownload(speechIntent())
  }

  fun destroy() {
    handler.removeCallbacksAndMessages(null)
    probes.forEach { it.destroy() }
    probes.clear()
    downloader?.destroy()
    downloader = null
  }
}
