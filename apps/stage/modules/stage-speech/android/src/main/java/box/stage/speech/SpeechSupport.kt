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

internal fun speechIntent(request: SpeechRequest = SpeechRequest(Locale.getDefault().toLanguageTag())): Intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
  putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
  request.options().forEach { (key, value) -> putExtra(key, value) }
  if (request.automatic) putStringArrayListExtra(RecognizerIntent.EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES, ArrayList(request.languages))
  putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
  putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
}

internal class SpeechSupport(private val context: Context) {
  private val handler = Handler(Looper.getMainLooper())
  private val probes = mutableSetOf<SpeechRecognizer>()
  private var downloader: SpeechRecognizer? = null
  private var generation = 0
  var languages = SpeechLanguages(Build.VERSION.SDK_INT, Locale.getDefault().toLanguageTag())
    private set

  fun available(): Boolean = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

  private fun result(ready: Boolean, download: Boolean = false, reason: String? = null, plan: SpeechLanguages = languages): Map<String, Any> {
    val value = mutableMapOf<String, Any>("available" to ready, "download" to download, "locale" to plan.defaultLocale)
    if (reason != null) value["reason"] = reason
    if (ready) plan.notice?.let { value["notice"] = it }
    return value
  }

  fun check(done: (Map<String, Any>) -> Unit) {
    val current = ++generation
    val locale = Locale.getDefault().toLanguageTag()
    languages = SpeechLanguages(Build.VERSION.SDK_INT, locale)
    if (!available()) {
      done(result(false, reason = "On-device dictation needs Android 12 or later and an installed on-device speech service. Use typing or + to record voice."))
      return
    }
    if (Build.VERSION.SDK_INT < 33) { done(result(true)); return }
    val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
    probes.add(recognizer)
    var finished = false
    lateinit var timeout: Runnable
    fun finish(ready: Boolean, download: Boolean = false, reason: String? = null, installed: List<String> = emptyList()) {
      if (finished) return
      finished = true
      handler.removeCallbacks(timeout)
      probes.remove(recognizer)
      recognizer.destroy()
      val plan = SpeechLanguages(Build.VERSION.SDK_INT, locale, installed)
      if (generation == current) languages = plan
      done(result(ready, download, reason, plan))
    }
    timeout = Runnable { finish(true) }
    handler.postDelayed(timeout, 5000)
    try {
      recognizer.checkRecognitionSupport(speechIntent(SpeechRequest(locale)), context.mainExecutor, object : RecognitionSupportCallback {
        override fun onSupportResult(support: RecognitionSupport) {
          val models = SpeechModels(locale, support.installedOnDeviceLanguages, support.pendingOnDeviceLanguages, support.supportedOnDeviceLanguages)
          finish(models.available, models.download, models.reason, models.installed)
        }
        override fun onError(error: Int) { finish(true) }
      })
    } catch (error: Exception) {
      finish(false, reason = "The on-device speech service could not be checked. Try again or use + to record voice.")
    }
  }

  fun download() {
    check(Build.VERSION.SDK_INT >= 33 && available()) { "Install the speech language model in your device's speech settings." }
    val recognizer = downloader ?: SpeechRecognizer.createOnDeviceSpeechRecognizer(context).also { downloader = it }
    recognizer.triggerModelDownload(speechIntent())
  }

  fun destroy() {
    generation += 1
    handler.removeCallbacksAndMessages(null)
    probes.forEach { it.destroy() }
    probes.clear()
    downloader?.destroy()
    downloader = null
  }
}
