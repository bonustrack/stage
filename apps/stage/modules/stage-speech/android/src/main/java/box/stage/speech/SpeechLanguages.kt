package box.stage.speech

import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

internal data class SpeechRequest(val locale: String, val languages: List<String> = emptyList()) {
  val automatic: Boolean get() = languages.isNotEmpty()

  fun options(): Map<String, String> {
    val options = mutableMapOf(RecognizerIntent.EXTRA_LANGUAGE to locale)
    if (automatic) options[RecognizerIntent.EXTRA_ENABLE_LANGUAGE_SWITCH] = RecognizerIntent.LANGUAGE_SWITCH_BALANCED
    return options
  }
}

internal class SpeechModels(
  private val locale: String,
  val installed: List<String> = emptyList(),
  private val pending: List<String> = emptyList(),
  private val supported: List<String> = emptyList()
) {
  private fun matches(values: List<String>): Boolean = values.any { it.equals(locale, ignoreCase = true) }

  val available: Boolean get() = matches(installed) || (installed.isEmpty() && pending.isEmpty() && supported.isEmpty())
  val download: Boolean get() = !matches(installed) && !matches(pending) && matches(supported)
  val reason: String? get() = when {
    available || download -> null
    matches(pending) -> "The speech model is still downloading. Try the mic again later, or use + to record voice."
    else -> "On-device dictation is unavailable for $locale. Change the device language, type, or use + to record voice."
  }
}

internal class SpeechLanguages(
  private val sdk: Int,
  val defaultLocale: String,
  installed: List<String> = emptyList()
) {
  private val installed = installed.map { Locale.forLanguageTag(it).toLanguageTag() }.filter { it != "und" }.distinct()
  private val eligible = sdk >= 34 && this.installed.contains(defaultLocale) && this.installed.map { Locale.forLanguageTag(it).language }.distinct().size > 1
  private var locale = defaultLocale
  private var disabled = false

  val notice: String? get() = when {
    eligible -> "Automatic language switching depends on your device's speech engine. If it stays in $defaultLocale, switching may not be supported."
    sdk < 34 -> "Dictation uses $defaultLocale. Automatic language switching needs Android 14 or later."
    installed.isNotEmpty() -> "Dictation uses $defaultLocale. Other languages need installed on-device speech models. Check your device's speech settings."
    else -> "Dictation uses $defaultLocale. Automatic language switching could not be checked on this device."
  }

  val fallbackNotice: String get() = "Language switching is unavailable. Continuing in $defaultLocale. Your draft was kept; check it before sending."

  fun request(): SpeechRequest = SpeechRequest(locale, if (eligible && !disabled) installed else emptyList())

  fun reset() {
    locale = defaultLocale
    disabled = false
  }

  private fun allowed(detected: String?): String? = installed.firstOrNull { it.equals(detected, ignoreCase = true) }

  fun switched(result: Int, detected: String?): String? {
    if (!request().automatic || result != SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED) return null
    val matched = allowed(detected) ?: return null
    locale = matched
    return matched
  }

  fun switchFailed(result: Int, detected: String?): Boolean {
    if (!request().automatic) return false
    return when (result) {
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_FAILED -> true
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL -> detected.isNullOrBlank() || allowed(detected) != null
      else -> false
    }
  }

  fun fallback(error: Int? = null): Boolean {
    if (error != null && error != SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED && error != SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE) return false
    if (!request().automatic) return false
    disabled = true
    locale = defaultLocale
    return true
  }
}
