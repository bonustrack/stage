package box.metro.pill

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * MetroFcmService — PRIVACY-PRESERVING push handler. The daemon/FCM/Google never
 * see message plaintext: the daemon sends a CONTENTLESS, data-only, high-priority
 * push carrying ONLY routing metadata:
 *
 *   data: { channelId: "xmtp", account, line?, convId?, messageId, isGroup? }
 *
 * There is NO title, body, preview, sender name, avatar, or group name in the
 * push. This service posts a GENERIC "New message" card from that metadata; the
 * device holds the XMTP key and the in-app stream renders the real content when
 * the conversation is opened (deep-linked from the card tap).
 *
 * PHASE-2 FOLLOW-UP (rich on-device preview): a background headless-JS decrypt
 * that opens the on-device XMTP RN client to derive sender + preview was assessed
 * as unreliable in a backgrounded/Doze app (FCM ~10s dispatch budget vs the RN
 * SDK's up-to-20s MLS Client.build, plus sqlite-store lock contention with the
 * foreground app, and a new expo-task-manager native dep). So we ship the
 * generic-card fallback — a clear privacy win — and leave rich previews for a
 * follow-up once a reliable background-decrypt path exists.
 *
 * SUPPRESSION: a contentless push for the conversation the user is currently
 * viewing is still dropped (the convId match against the shared prefs, below).
 *
 * DELEGATION: any non-xmtp push (plain FCM notification, or a data message
 * without channelId == "xmtp") is forwarded to an *instance* of Expo's own
 * FirebaseMessagingService (created reflectively) so existing
 * expo-notifications behaviour is preserved. This service is the ONLY
 * MESSAGING_EVENT receiver in the merged manifest — Expo's receiver is stripped
 * via tools:node="remove" (see withMetroPill) to stop the duplicate card.
 */
class MetroFcmService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    // Let Expo manage token registration; just forward.
    runCatching { delegateNewToken(token) }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    // Only handle our CONTENTLESS xmtp routing pushes here (channelId == "xmtp",
    // set by the daemon's fcmPushTo). Everything else is Expo's.
    if (data["channelId"] != XMTP_CHANNEL_ID) {
      runCatching { delegateMessage(message) }
      return
    }

    // PRIVACY: the push carries NO plaintext — no title/body/avatar/sender/group
    // name. We build a GENERIC card from routing metadata only. The device holds
    // the XMTP key; rich on-device decrypt is tracked as Phase-2 follow-up.
    val channelId = DEFAULT_CHANNEL_ID
    val line = data["line"]
    val isGroup = data["isGroup"] == "true" || data["isGroup"] == "1"
    val title = "Metro"
    val body = if (isGroup) "New message in a group" else "New message"

    // SUPPRESSION: if the user is currently viewing this exact conversation
    // (app foreground + that screen focused), the conversation screen has
    // written its bare convId into the shared "metro_pill" prefs. The push
    // carries the conv via `line` (metro://xmtp/<acct>/<convId> or legacy
    // metro://xmtp/<convId>) and/or an explicit `convId` data field. We extract
    // the bare convId from both and, on an exact match, drop the notification —
    // the user has already seen it. Cleared (null) on blur/background, so the
    // default (no stored value) NEVER suppresses; only an exact match does.
    val pushConvId = data["convId"]?.takeIf { it.isNotBlank() } ?: convIdOfLine(line)
    if (pushConvId != null) {
      // Read from the APPLICATION context (not the Service `this` context) so we
      // hit the SAME SharedPreferencesImpl/file the writer
      // (MetroPillModule.setActiveConversation, also via applicationContext)
      // committed to. Reading via `this`/Service context resolved a different
      // SharedPreferences instance, so the active-conv value was never visible
      // here — the root cause of suppression never firing.
      val active = applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(KEY_ACTIVE_CONV, null)
      if (active != null && active == pushConvId) return
    }

    ensureChannel(channelId)

    // STABLE PER-CONVERSATION NOTIFICATION ID: derive a stable id from the bare
    // convId so re-notifying the SAME conversation UPDATES the same card instead
    // of stacking a new one. Fall back to a constant when there's no convId.
    val notifId = pushConvId?.hashCode() ?: GENERIC_NOTIF_ID

    // GENERIC privacy-preserving card: routing-only push carries no plaintext, so
    // we show a content-free "New message" heading. Tapping opens the exact
    // conversation (deep link below) where the app decrypts + renders for real.
    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(smallIconRes())
      .setContentTitle(title)
      .setContentText(body)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))

    contentIntent(line)?.let { builder.setContentIntent(it) }

    if (NotificationManagerCompat.from(this).areNotificationsEnabled()) {
      try {
        NotificationManagerCompat.from(this).notify(notifId, builder.build())
      } catch (_: SecurityException) {
        // POST_NOTIFICATIONS not granted — silently drop.
      }
    }
  }

  /** Extract the bare conversation id from a metro line URI. Handles both the
   *  account-scoped `metro://xmtp/<acct>/<convId>` and the legacy
   *  `metro://xmtp/<convId>` form by taking the LAST path segment — which is
   *  the convId in both, and matches what the conversation screen stores. */
  private fun convIdOfLine(line: String?): String? {
    if (line.isNullOrBlank()) return null
    val tail = line.substringAfterLast('/', "").substringBefore('?')
    return tail.takeIf { it.isNotBlank() }
  }

  /** Tap → open the exact conversation via an expo-router deep link.
   *
   *  WHY ACTION_VIEW (not a launch intent + extra): this notification is posted
   *  NATIVELY, so expo-notifications' JS response listener never fires on tap —
   *  the app's `usePushDeepLinks` never sees it. Instead we fire an
   *  `ACTION_VIEW metro://xmtp/<convId>` at the app's own scheme. expo-router +
   *  expo-linking auto-route that URL (path-based) to `app/xmtp/[convId].tsx` on
   *  BOTH cold start (getInitialURL) and warm tap (the `url` Linking event) with
   *  no JS change needed. The app's MainActivity already declares the `metro`
   *  scheme intent-filter (expo injects it from app.json `"scheme": "metro"`).
   *
   *  We deep-link the BARE convId (`metro://xmtp/<convId>`), not the raw `line`
   *  (which may be account-scoped `metro://xmtp/<acct>/<convId>` — 3 segments
   *  expo-router can't map to the single-segment `[convId]` route). `convIdOfLine`
   *  takes the last path segment, matching what the conversation screen expects.
   *  Falls back to a plain launch intent when there's no conv to target. */
  private fun contentIntent(line: String?): PendingIntent? {
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    val convId = convIdOfLine(line)
    if (convId == null) {
      val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
      return PendingIntent.getActivity(this, 0, launch, flags)
    }
    val view = Intent(Intent.ACTION_VIEW, Uri.parse("metro://xmtp/$convId")).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    return PendingIntent.getActivity(this, convId.hashCode(), view, flags)
  }

  private fun ensureChannel(channelId: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (mgr.getNotificationChannel(channelId) == null) {
      mgr.createNotificationChannel(
        NotificationChannel(channelId, "Messages", NotificationManager.IMPORTANCE_HIGH),
      )
    }
  }

  /** Resolve the Expo/Firebase default notification icon at runtime so we don't
   *  depend on the host app's generated R class. Falls back to the app icon. */
  private fun smallIconRes(): Int {
    val byName = resources.getIdentifier("notification_icon", "drawable", packageName)
    if (byName != 0) return byName
    return applicationInfo.icon
  }

  // --- delegation to Expo's FirebaseMessagingService -----------------------
  // We reflectively forward so a missing/renamed Expo class never crashes the
  // app — non-xmtp pushes simply behave as before.

  private fun delegateMessage(message: RemoteMessage) {
    val svc = expoService() ?: return
    val m = FirebaseMessagingService::class.java
      .getDeclaredMethod("onMessageReceived", RemoteMessage::class.java)
      .apply { isAccessible = true }
    m.invoke(svc, message)
  }

  private fun delegateNewToken(token: String) {
    val svc = expoService() ?: return
    val m = FirebaseMessagingService::class.java
      .getDeclaredMethod("onNewToken", String::class.java)
      .apply { isAccessible = true }
    m.invoke(svc, token)
  }

  /** Instantiate Expo's service and attach this context so its lifecycle
   *  helpers (getApplicationContext, etc.) work. */
  private fun expoService(): FirebaseMessagingService? = runCatching {
    val cls = Class.forName("expo.modules.notifications.service.ExpoFirebaseMessagingService")
    val svc = cls.getDeclaredConstructor().newInstance() as FirebaseMessagingService
    val attach = android.content.ContextWrapper::class.java
      .getDeclaredMethod("attachBaseContext", Context::class.java)
      .apply { isAccessible = true }
    attach.invoke(svc, applicationContext)
    svc
  }.getOrNull()

  companion object {
    private const val DEFAULT_CHANNEL_ID = "metro-messages"

    // Routing-only xmtp pushes carry channelId == "xmtp" (set by the daemon's
    // fcmPushTo). Anything else is delegated to Expo's messaging service.
    private const val XMTP_CHANNEL_ID = "xmtp"

    // Notification id used when a push has no convId to derive a stable id from.
    private const val GENERIC_NOTIF_ID = 424242

    // Shared with MetroPillModule.setActiveConversation — the conversation the
    // user is currently viewing (bare convId), for notification suppression.
    private const val PREFS_NAME = "metro_pill"
    private const val KEY_ACTIVE_CONV = "active_conv"
  }
}
