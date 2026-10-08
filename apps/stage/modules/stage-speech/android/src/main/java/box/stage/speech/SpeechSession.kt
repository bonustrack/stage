package box.stage.speech

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.SpeechRecognizer
import androidx.annotation.RequiresApi

@RequiresApi(31)
internal class SpeechSession(
  context: Context,
  val id: String,
  private val languages: SpeechLanguages,
  private val emit: (Map<String, Any>) -> Unit,
  private val finished: () -> Unit
) : RecognitionListener {
  private val recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
  private val request = languages.request()
  private val handler = Handler(Looper.getMainLooper())
  private var ended = false
  private var stopping = false
  private var recovering = false
  private var text = ""

  fun start() {
    recognizer.setRecognitionListener(this)
    recognizer.startListening(speechIntent(request))
    if (!ended) handler.postDelayed({ stop() }, 60_000)
  }

  fun stop() {
    if (ended || stopping || recovering) return
    stopping = true
    handler.removeCallbacksAndMessages(null)
    recognizer.stopListening()
    emit(mapOf("sessionId" to id, "state" to "finishing"))
    handler.postDelayed({ finish("Dictation could not finish. Check your draft and tap the mic to try again.", "cancelled") }, 5000)
  }

  fun cancel(error: String? = null) {
    if (ended) return
    try { recognizer.cancel() } finally { finish(error, "cancelled") }
  }

  private fun finish(error: String? = null, reason: String = "segment", notice: String? = null) {
    if (ended) return
    ended = true
    handler.removeCallbacksAndMessages(null)
    recognizer.destroy()
    finished()
    val event = mutableMapOf<String, Any>("sessionId" to id, "state" to "ended", "reason" to reason)
    if (error != null) event["error"] = error
    if (notice != null) event["notice"] = notice
    emit(event)
  }

  private fun fallback(error: Int? = null): Boolean {
    if (!request.automatic || !languages.fallback(error)) return false
    recovering = true
    try { recognizer.cancel() }
    catch (error: Exception) {
      finish("Could not release dictation audio. Tap the mic to try again. Your draft was kept.", "cancelled")
      return true
    }
    finish(reason = "fallback", notice = languages.fallbackNotice)
    return true
  }

  private fun update(results: Bundle?) {
    if (ended || recovering) return
    val next = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
    if (next.isBlank()) return
    text = next
    emit(mapOf("sessionId" to id, "text" to text))
  }

  override fun onReadyForSpeech(params: Bundle?) {
    if (!ended && !stopping && !recovering) emit(mapOf("sessionId" to id, "state" to "listening"))
  }
  override fun onPartialResults(partialResults: Bundle?) { update(partialResults) }
  override fun onResults(results: Bundle?) {
    if (ended || recovering) return
    update(results)
    finish()
  }
  override fun onEndOfSpeech() { stop() }
  override fun onLanguageDetection(results: Bundle) {
    if (ended || stopping || recovering || !request.automatic) return
    val result = results.getInt(SpeechRecognizer.LANGUAGE_SWITCH_RESULT, SpeechRecognizer.LANGUAGE_SWITCH_RESULT_NOT_ATTEMPTED)
    val detected = results.getString(SpeechRecognizer.DETECTED_LANGUAGE)
    if (languages.switchFailed(result, detected)) {
      fallback()
      return
    }
    val locale = languages.switched(result, detected) ?: return
    emit(mapOf("sessionId" to id, "locale" to locale))
  }
  override fun onError(error: Int) {
    if (ended || recovering) return
    if (fallback(error)) return
    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
      finish(reason = "silence")
      return
    }
    val message = when (error) {
      SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "On-device dictation is unavailable for your device language. Type or use + to record voice."
      SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "The speech language model is not installed. Download it in your device's speech settings, then try again."
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Allow microphone access in Settings to use dictation."
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> "The speech recognizer is busy. Wait a moment and tap the mic again."
      SpeechRecognizer.ERROR_AUDIO -> "The microphone is unavailable. Stop other audio capture and try again."
      else -> "On-device dictation stopped. Your draft was kept. Tap the mic to try again."
    }
    finish(message)
  }
  override fun onBeginningOfSpeech() {}
  override fun onRmsChanged(rmsdB: Float) {}
  override fun onBufferReceived(buffer: ByteArray?) {}
  override fun onEvent(eventType: Int, params: Bundle?) {}
}
