package box.metro.pill

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.LocusIdCompat
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

/**
 * MetroPill — native Android support for:
 *   (1) Android Bubbles (conversation shortcut + bubble notification) for a
 *       1-1 DM; and
 *   (2) the push-notification plumbing the custom FCM service reads
 *       (active-conversation + app-foreground suppression flags, and the
 *       `onXmtpPush` event MetroFcmService emits on every contentless push).
 */
class MetroPillModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No react context")

  override fun definition() = ModuleDefinition {
    Name("MetroPill")

    // `onXmtpPush` is fired by MetroFcmService (via the companion `emit`) on every
    // contentless xmtp push so JS can force a sync + reload the open feed — the
    // real-time delivery signal that replaces the removed periodic poll.
    Events("onError", "onXmtpPush")

    OnCreate {
      instanceRef = WeakReference(this@MetroPillModule)
    }
    OnDestroy {
      if (instanceRef?.get() === this@MetroPillModule) instanceRef = null
    }

    // ---- Android Bubbles ----

    Function("isBubblesSupported") {
      bubblesSupported()
    }

    AsyncFunction("openAsBubble") { convId: String, title: String, deepLink: String, avatarUri: String? ->
      postBubble(convId, title, deepLink, avatarUri)
    }

    // ---- Active-conversation tracking (notification suppression) ----
    // The conversation screen reports the convId it's currently showing (on
    // focus) and clears it (null) on blur / background. MetroFcmService — which
    // runs in a SEPARATE process/context for FCM dispatch — reads this from
    // SharedPreferences and suppresses the push when it matches the inbound
    // message's conversation (the user is already looking at it). Stored in
    // prefs so it survives the JS↔FCM process boundary; null clears the key so
    // no suppression happens by default.
    Function("setActiveConversation") { convId: String? ->
      // Resolve prefs from the APPLICATION context (not the react/activity
      // context) so the writer and MetroFcmService — which reads from the
      // application context — hit the SAME SharedPreferencesImpl/file. Use
      // commit() (synchronous) instead of apply() to eliminate the apply()
      // visibility race the diagnosis flagged: the write must be on disk
      // before a push arrives a moment later.
      val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().apply {
        if (convId.isNullOrBlank()) remove(KEY_ACTIVE_CONV)
        else putString(KEY_ACTIVE_CONV, convId)
      }.commit()
      true
    }

    // ---- App-foreground tracking (rich foreground-notification handoff) ----
    // When the app is warm/foregrounded the live XMTP stream already holds the
    // DECRYPTED message, so the JS layer posts a RICH local notification (real
    // sender + preview) for conversations the user isn't viewing. To avoid a
    // DUPLICATE card, MetroFcmService must NOT also post its generic card while
    // foregrounded — so JS sets this `app_foreground` flag on active / clears it
    // on background, and onMessageReceived skips the generic card when it's true.
    // Same prefs file + commit() (synchronous) pattern as setActiveConversation
    // so the FCM process reads a value that's already on disk.
    Function("setAppForeground") { foreground: Boolean ->
      val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit().putBoolean(KEY_APP_FOREGROUND, foreground).commit()
      true
    }
  }

  private fun bubblesSupported(): Boolean {
    // Bubbles are production-usable only on API 30+. API 29 (Q) was dev-flag only.
    if (Build.VERSION.SDK_INT < 30) return false
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
    // App-level user toggle: NONE means the user disabled bubbles for the whole
    // app → nothing we can do. ALL or SELECTED both mean the app may post bubbles
    // (SELECTED just defers the per-conversation promotion to the user).
    if (nm.bubblePreference == android.app.NotificationManager.BUBBLE_PREFERENCE_NONE) return false
    // Make sure OUR channel exists with allowBubbles=true. We DON'T gate on
    // channel.canBubble() here: canBubble() also folds in the per-conversation
    // (SELECTED-mode) promotion state, which is false until the user promotes the
    // first bubble — gating on it would make isBubblesSupported() return false
    // forever under the default "Selected conversations can bubble" setting (the
    // exact false-negative we hit). The app-level preference (!= NONE) is the
    // real capability gate; the OS decides per-conversation promotion when we
    // actually post the bubble.
    ensureBubbleChannel()
    return true
  }

  private fun ensureBubbleChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
    val existing = nm.getNotificationChannel(CHANNEL_ID)
    if (existing != null) {
      // allowBubbles is one of the few channel settings an app can keep re-granting
      // after creation (a capability it owns). If a prior build created this
      // channel without it, recreate-on-top to flip it on so the bubble we post is
      // honoured. canBubble() reads the EFFECTIVE state (app pref ∧ channel ∧
      // conversation), so we can't use it to detect "allowBubbles was never set" —
      // just re-assert it unconditionally; createNotificationChannel is a no-op
      // when nothing changed.
      if (Build.VERSION.SDK_INT >= 30) {
        existing.setAllowBubbles(true)
        nm.createNotificationChannel(existing)
      }
      return
    }
    val channel = android.app.NotificationChannel(
      CHANNEL_ID, "Conversations", android.app.NotificationManager.IMPORTANCE_HIGH,
    )
    // Conversation-style channel: allow bubbles (API 30+) so the bubble we post
    // on it is honoured by the system.
    if (Build.VERSION.SDK_INT >= 30) channel.setAllowBubbles(true)
    nm.createNotificationChannel(channel)
  }

  private fun loadIcon(avatarUri: String?): IconCompat {
    if (avatarUri != null) {
      try {
        val path = Uri.parse(avatarUri).path
        if (path != null) {
          val bmp = android.graphics.BitmapFactory.decodeFile(path)
          if (bmp != null) return IconCompat.createWithAdaptiveBitmap(bmp)
        }
      } catch (_: Throwable) { /* fall through to launcher icon */ }
    }
    return IconCompat.createWithResource(context, context.applicationInfo.icon)
  }

  private fun postBubble(convId: String, title: String, deepLink: String, avatarUri: String?) {
    if (Build.VERSION.SDK_INT < 30) {
      sendEvent("onError", mapOf("message" to "bubbles-unsupported"))
      return
    }
    ensureBubbleChannel()

    val icon = loadIcon(avatarUri)
    val person = Person.Builder()
      .setName(title)
      .setKey(convId)
      .setIcon(icon)
      .build()

    val target = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT or Intent.FLAG_ACTIVITY_MULTIPLE_TASK)
    }

    // Long-lived dynamic shortcut — required so the bubble + locus link resolve.
    val shortcut = ShortcutInfoCompat.Builder(context, convId)
      .setLongLived(true)
      .setShortLabel(title)
      .setIcon(icon)
      .setPerson(person)
      .setLocusId(LocusIdCompat(convId))
      .setIntent(target)
      .setCategories(setOf("box.metro.pill.category.CONVERSATION"))
      .build()
    ShortcutManagerCompat.pushDynamicShortcut(context, shortcut)

    val pi = PendingIntent.getActivity(
      context, convId.hashCode(), target,
      PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    val bubbleMeta = NotificationCompat.BubbleMetadata.Builder(pi, icon)
      .setDesiredHeight(600)
      .setAutoExpandBubble(true)
      .setSuppressNotification(true)
      .build()

    val style = NotificationCompat.MessagingStyle(person)
      .addMessage("Tap to open chat", System.currentTimeMillis(), person)

    val notif = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setShortcutId(convId)
      .setLocusId(LocusIdCompat(convId))
      .addPerson(person)
      .setStyle(style)
      .setBubbleMetadata(bubbleMeta)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setContentIntent(pi)
      .build()

    try {
      NotificationManagerCompat.from(context).notify(convId.hashCode(), notif)
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS not granted (API 33+).
      sendEvent("onError", mapOf("message" to "notifications-permission-missing"))
    }
  }

  companion object {
    const val CHANNEL_ID = "metro-conversations"

    /** SharedPreferences shared with MetroFcmService for notification
     *  suppression of the currently-open conversation. */
    const val PREFS_NAME = "metro_pill"
    const val KEY_ACTIVE_CONV = "active_conv"

    /** Whether the app is currently foregrounded. When true, MetroFcmService
     *  skips its generic card so the JS layer posts the rich one (no dupes). */
    const val KEY_APP_FOREGROUND = "app_foreground"

    /** Weak ref so MetroFcmService (a separate FCM-dispatch context) can deliver
     *  the `onXmtpPush` event back into JS without leaking the module across JS
     *  reloads. Cleared in OnDestroy. */
    @Volatile
    var instanceRef: WeakReference<MetroPillModule>? = null

    /** Called from MetroFcmService — no-ops if no module is currently attached
     *  (the FCM card still posts and the contentless push still wakes a cold JS
     *  on next launch). */
    fun emit(name: String, payload: Map<String, Any?>) {
      instanceRef?.get()?.sendEvent(name, payload)
    }
  }
}
