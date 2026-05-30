package box.metro.pill

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Shader
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.min

/**
 * MetroFcmService — renders Telegram-style push notifications with the sender's
 * avatar as the round LARGE ICON on the left of the notification card.
 *
 * WHY a custom service: FCM v1 *notification* payloads cannot carry a largeIcon
 * — `setLargeIcon` is a client-side NotificationCompat.Builder feature. So the
 * avatar must be downloaded and the notification built natively. This service
 * handles FCM **data** messages shaped:
 *
 *   data: { title, body, avatarUrl, channelId, line? }
 *
 * (line = optional metro:// deep-link to open the right conversation.)
 *
 * It downloads `avatarUrl`, circular-crops it (same approach as
 * OverlayView.CircleBitmapDrawable), and posts a NotificationCompat using
 * MessagingStyle with a Person whose icon is the round avatar. This is how
 * Telegram gets the sender avatar in the FAR-LEFT slot: MessagingStyle promotes
 * the Person icon to the large round avatar on the LEFT of the card on Samsung
 * OneUI (and the expanded card on stock Android), and DEMOTES the mandatory app
 * small-icon to a tiny monochrome badge overlapping the avatar's corner.
 *
 * HARD OEM LIMITATION: Android REQUIRES setSmallIcon() on every notification and
 * always draws it somewhere (corner badge in MessagingStyle, header top-left in
 * DecoratedCustomViewStyle). It can never be replaced by the avatar or removed.
 * MessagingStyle is the closest-to-Telegram result because it shrinks that icon
 * to a corner badge instead of the prominent header slot — which is exactly the
 * problem with the previous DecoratedCustomViewStyle + custom-RemoteViews path
 * (that style ALWAYS renders the system header with the 'M' icon top-left, so
 * the avatar could never take the far-left slot). Falls back to a plain
 * BigTextStyle card if the avatar fails to download.
 *
 * DELEGATION: any message that is NOT an avatar-data push (a plain FCM
 * notification message, or a data message without `avatarUrl`) is forwarded to
 * an *instance* of Expo's own FirebaseMessagingService (created reflectively)
 * so existing expo-notifications behaviour is preserved. This service is the
 * ONLY MESSAGING_EVENT receiver in the merged manifest — Expo's receiver is
 * stripped via tools:node="remove" (see withMetroPill) to stop the duplicate
 * card. The delegation does NOT need Expo's manifest receiver: it instantiates
 * the class directly, so non-avatar pushes still post exactly as before.
 *
 * DAEMON FOLLOW-UP (not wired here): the daemon (~/.metro/trains/xmtp.ts
 * fcmPushTo) must send these as high-priority **data** messages carrying
 * {title, body, avatarUrl} — see the report. Until then this service is inert
 * (it just delegates), so shipping it in the APK is safe.
 */
class MetroFcmService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    // Let Expo manage token registration; just forward.
    runCatching { delegateNewToken(token) }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    val avatarUrl = data["avatarUrl"]
    // Only handle our avatar data-pushes here; everything else is Expo's.
    if (avatarUrl.isNullOrBlank()) {
      runCatching { delegateMessage(message) }
      return
    }

    val title = data["title"] ?: message.notification?.title ?: "Metro"
    val body = data["body"] ?: message.notification?.body ?: ""
    val channelId = data["channelId"] ?: DEFAULT_CHANNEL_ID
    val line = data["line"]

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
      val active = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(KEY_ACTIVE_CONV, null)
      if (active != null && active == pushConvId) return
    }

    ensureChannel(channelId)

    val avatar = runCatching { downloadAndCircleCrop(avatarUrl) }.getOrNull()

    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(smallIconRes())
      .setContentTitle(title)
      .setContentText(body)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)

    if (avatar != null) {
      // AVATAR ON THE FAR LEFT (Telegram-style) via MessagingStyle + Person icon.
      // MessagingStyle renders the Person's icon as the large round avatar on the
      // LEFT of the card (OneUI collapsed + stock expanded) and demotes the
      // mandatory app small-icon to a tiny corner badge — the closest achievable
      // to Telegram. The Person is the SENDER (title); "self" is left default.
      val sender = Person.Builder()
        .setName(title)
        .setIcon(IconCompat.createWithBitmap(avatar))
        .build()
      builder.setStyle(
        NotificationCompat.MessagingStyle(
          Person.Builder().setName("You").build(),
        ).addMessage(body, System.currentTimeMillis(), sender),
      )
    } else {
      // DEFENSIVE FALLBACK: avatar download failed — post a standard card so a
      // notification still shows (no avatar; small-icon only).
      builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
    }

    contentIntent(line)?.let { builder.setContentIntent(it) }

    if (NotificationManagerCompat.from(this).areNotificationsEnabled()) {
      try {
        NotificationManagerCompat.from(this)
          .notify(line?.hashCode() ?: title.hashCode(), builder.build())
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

  /** Download `url` and circular-crop to a square bitmap (mirrors
   *  OverlayView.CircleBitmapDrawable's square-crop + circle clip). */
  private fun downloadAndCircleCrop(url: String): Bitmap? {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      // 4s keeps the synchronous avatar download under FCM's ~10s dispatch budget so largeIcon is attached before the first notify()
      connectTimeout = 4000
      readTimeout = 4000
      instanceFollowRedirects = true
    }
    return try {
      conn.inputStream.use { stream ->
        val src = BitmapFactory.decodeStream(stream) ?: return null
        circleCrop(src)
      }
    } finally {
      conn.disconnect()
    }
  }

  private fun circleCrop(src: Bitmap): Bitmap {
    val side = min(src.width, src.height)
    val x = (src.width - side) / 2
    val y = (src.height - side) / 2
    val square = if (src.width == side && src.height == side) src
      else Bitmap.createBitmap(src, x, y, side, side)
    val out = Bitmap.createBitmap(side, side, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      shader = BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
    }
    canvas.drawCircle(side / 2f, side / 2f, side / 2f, paint)
    return out
  }

  // --- delegation to Expo's FirebaseMessagingService -----------------------
  // We reflectively forward so a missing/renamed Expo class never crashes the
  // app — non-avatar pushes simply behave as before.

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

    // Shared with MetroPillModule.setActiveConversation — the conversation the
    // user is currently viewing (bare convId), for notification suppression.
    private const val PREFS_NAME = "metro_pill"
    private const val KEY_ACTIVE_CONV = "active_conv"
  }
}
