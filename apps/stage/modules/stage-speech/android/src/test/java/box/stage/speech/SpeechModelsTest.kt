package box.stage.speech

import org.junit.Assert.*
import org.junit.Test

class SpeechModelsTest {
  @Test fun onlyInstalledLanguagesAreEligibleForAutomaticSwitching() {
    val models = SpeechModels("en-US", listOf("en-US", "fr-FR"), listOf("de-DE"), listOf("es-ES"))
    assertTrue(models.available)
    assertFalse(models.download)
    assertNull(models.reason)
    val request = SpeechLanguages(34, "en-US", models.installed).request()
    assertEquals(listOf("en-US", "fr-FR"), request.languages)
  }

  @Test fun downloadableModelsDoNotBecomeInstalledModels() {
    val models = SpeechModels("fr-FR", listOf("en-US"), supported = listOf("fr-FR", "de-DE"))
    assertFalse(models.available)
    assertTrue(models.download)
    assertNull(models.reason)
    assertFalse(SpeechLanguages(34, "fr-FR", models.installed).request().automatic)
  }

  @Test fun pendingModelsDoNotTriggerAnotherDownload() {
    val models = SpeechModels("fr-FR", listOf("en-US"), listOf("fr-FR"), listOf("fr-FR"))
    assertFalse(models.available)
    assertFalse(models.download)
    assertTrue(models.reason?.contains("still downloading") == true)
  }

  @Test fun unavailableDefaultLanguageDoesNotSilentlyChooseAnotherOne() {
    val models = SpeechModels("de-DE", listOf("en-US", "fr-FR"))
    assertFalse(models.available)
    assertFalse(models.download)
    assertTrue(models.reason?.contains("de-DE") == true)
  }

  @Test fun absentInventoryRetainsProvisionalLegacyReadinessButNeverAutomaticSwitching() {
    val models = SpeechModels("en-US")
    assertTrue(models.available)
    assertFalse(models.download)
    assertFalse(SpeechLanguages(34, "en-US", models.installed).request().automatic)
  }

  @Test fun installedReadinessWinsOverRedundantPendingOrDownloadableEntries() {
    val models = SpeechModels("en-US", listOf("en-us"), listOf("en-US"), listOf("en-US"))
    assertTrue(models.available)
    assertFalse(models.download)
    assertNull(models.reason)
  }
}
