package box.stage.speech

import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.junit.Assert.*
import org.junit.Test

class SpeechLanguagesTest {
  private fun languages(sdk: Int = 34, installed: List<String> = listOf("en-US", "fr-FR", "de-DE")) = SpeechLanguages(sdk, "en-US", installed)

  @Test fun balancedSwitchingUsesOnlyInstalledModels() {
    val plan = languages(installed = listOf("en-US", "fr-fr", "fr-FR"))
    val request = plan.request()
    assertTrue(request.automatic)
    assertEquals(listOf("en-US", "fr-FR"), request.languages)
    assertEquals("en-US", request.options()[RecognizerIntent.EXTRA_LANGUAGE])
    assertEquals(RecognizerIntent.LANGUAGE_SWITCH_BALANCED, request.options()[RecognizerIntent.EXTRA_ENABLE_LANGUAGE_SWITCH])
    assertTrue(plan.notice?.contains("depends on your device's speech engine") == true)
    assertTrue(plan.notice?.contains("may not be supported") == true)
  }

  @Test fun olderAndroidKeepsTheDefaultLanguageWithoutSwitchExtras() {
    for (sdk in listOf(31, 32, 33)) {
      val plan = languages(sdk)
      assertFalse(plan.request().automatic)
      assertEquals(mapOf(RecognizerIntent.EXTRA_LANGUAGE to "en-US"), plan.request().options())
      assertTrue(plan.notice?.contains("Android 14") == true)
      assertFalse(plan.fallback())
    }
  }

  @Test fun missingUnknownOrSingleLanguageInventoriesNeverEnableSwitching() {
    for (installed in listOf(emptyList(), listOf("en-US"), listOf("fr-FR", "de-DE"), listOf("en-US", "en-GB"))) {
      val plan = languages(installed = installed)
      assertFalse(plan.request().automatic)
      assertNotNull(plan.notice)
      assertEquals("en-US", plan.request().locale)
    }
  }

  @Test fun laterAndroidUsesTheSameSwitchContract() {
    assertTrue(languages(35).request().automatic)
    assertTrue(languages(36).request().automatic)
  }

  @Test fun onlyConfirmedAllowedSwitchesChangeTheNextCaptureLanguage() {
    val plan = languages()
    assertNull(plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_NOT_ATTEMPTED, "fr-FR"))
    assertNull(plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "es-ES"))
    assertNull(plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, null))
    assertEquals("en-US", plan.request().locale)
    assertEquals("fr-FR", plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-fr"))
    assertEquals("fr-FR", plan.request().options()[RecognizerIntent.EXTRA_LANGUAGE])
    assertEquals(listOf("en-US", "fr-FR", "de-DE"), plan.request().languages)
  }

  @Test fun detectionAndFailedSwitchesNeverMasqueradeAsSuccess() {
    val plan = languages()
    for (result in listOf(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_NOT_ATTEMPTED, SpeechRecognizer.LANGUAGE_SWITCH_RESULT_FAILED, SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL, 99)) {
      assertNull(plan.switched(result, "fr-FR"))
      assertEquals("en-US", plan.request().locale)
    }
  }

  @Test fun outOfAllowlistSkipsKeepSwitchingAndTheLastConfirmedLocale() {
    val plan = languages()
    plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-FR")
    assertFalse(plan.switchFailed(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL, "es-ES"))
    assertNull(plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL, "es-ES"))
    assertTrue(plan.request().automatic)
    assertEquals("fr-FR", plan.request().locale)
    for (result in listOf(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_NOT_ATTEMPTED, SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, 99)) {
      assertFalse(plan.switchFailed(result, "de-DE"))
    }
    assertEquals("de-DE", plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "de-DE"))
  }

  @Test fun failedSwitchesAndMissingAllowedModelsRequestOneFallback() {
    val results = listOf(
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_FAILED to "fr-FR",
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_FAILED to "es-ES",
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL to "fr-fr",
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL to null,
      SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SKIPPED_NO_MODEL to ""
    )
    for ((result, detected) in results) {
      val plan = languages()
      plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-FR")
      assertTrue(plan.switchFailed(result, detected))
      assertTrue(plan.fallback())
      assertFalse(plan.switchFailed(result, detected))
      assertFalse(plan.fallback())
      assertEquals("en-US", plan.request().locale)
    }
  }

  @Test fun languageErrorsFallBackOnceForTheWholeLogicalSession() {
    for (error in listOf(SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE)) {
      val plan = languages()
      plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-FR")
      assertTrue(plan.fallback(error))
      assertFalse(plan.request().automatic)
      assertEquals("en-US", plan.request().locale)
      assertTrue(plan.fallbackNotice.contains("check it before sending"))
      assertFalse(plan.fallback(error))
      assertNull(plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "de-DE"))
      assertEquals("en-US", plan.request().locale)
    }
  }

  @Test fun busyAudioPermissionAndOtherErrorsNeverTriggerLanguageFallback() {
    val plan = languages()
    for (error in listOf(SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_AUDIO, SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS, SpeechRecognizer.ERROR_TOO_MANY_REQUESTS, SpeechRecognizer.ERROR_CLIENT, SpeechRecognizer.ERROR_SERVER, SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
      assertFalse(plan.fallback(error))
      assertTrue(plan.request().automatic)
    }
  }

  @Test fun explicitNewPreparationResetsFallbackAndRememberedLanguage() {
    val plan = languages()
    plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-FR")
    plan.reset()
    assertEquals("en-US", plan.request().locale)
    assertTrue(plan.fallback())
    assertFalse(plan.fallback())
    plan.reset()
    assertTrue(plan.request().automatic)
    assertEquals("en-US", plan.request().locale)
  }

  @Test fun captureRequestsRemainImmutableWhenLaterEventsChangeThePlan() {
    val plan = languages()
    val capture = plan.request()
    plan.switched(SpeechRecognizer.LANGUAGE_SWITCH_RESULT_SUCCEEDED, "fr-FR")
    plan.fallback()
    assertEquals("en-US", capture.locale)
    assertTrue(capture.automatic)
    assertFalse(plan.request().automatic)
  }
}
