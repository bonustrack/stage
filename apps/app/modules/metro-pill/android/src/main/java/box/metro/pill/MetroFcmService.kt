package box.metro.pill

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
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
 * AVATAR-ON-FIRST-POST: `onMessageReceived` runs on a background thread, so the
 * avatar bitmap is downloaded **synchronously** (blocking HTTP GET +
 * BitmapFactory.decodeStream) BEFORE the single `notify()` call. That way the
 * largeIcon is already attached when the collapsed notification first appears —
 * it no longer shows the app logo first and only swap in the avatar after the
 * user expands/scrolls. The download is bounded by a short connect+read timeout
 * (FCM kills the dispatch thread after ~10s) and any failure falls back to no
 * largeIcon (app icon) rather than blocking or crashing.
 *
 * DELEGATION: any message that is NOT an avatar-data push (a plain FCM
 * notification message, or a data message without `avatarUrl`) is forwarded to
 * Expo's own FirebaseMessagingService so existing expo-notifications behaviour
 * is preserved. Because only one FirebaseMessagingService can be the default
 * receiver, this service is declared with a higher manifest priority (see
 * withMetroPill config plugin) and shadows ExpoFirebaseMessagingService.
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

    ensureChannel(channelId)

    // We're on a background thread (FCM dispatch), so block on the avatar
    // download here — this guarantees the bitmap is ready and set as the
    // largeIcon BEFORE the first/only notify(), so the collapsed notification
    // already shows the round avatar instead of the app logo. Bounded timeout
    // + try/catch: on failure we just post without a largeIcon.
    val avatar = runCatching { downloadAndCircleCrop(avatarUrl) }.getOrNull()

    val person = Person.Builder()
      .setName(title)
      .apply { if (avatar != null) setIcon(IconCompat.createWithBitmap(avatar)) }
      .build()

    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(smallIconRes())
      .setContentTitle(title)
      .setContentText(body)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setStyle(
        NotificationCompat.MessagingStyle(person)
          .addMessage(body, System.currentTimeMillis(), person),
      )

    // Set the largeIcon on the builder up-front (before notify) whenever the
    // bitmap is available, so the collapsed card renders the avatar on first
    // post. Only when the download genuinely failed do we fall back to none.
    if (avatar != null) builder.setLargeIcon(avatar)
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

  /** Tap → open the app (deep-linking the exact conversation is JS-side via the
   *  existing notification-response handler; we pass `line` as an extra). */
  private fun contentIntent(line: String?): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    if (line != null) launch.putExtra("metroLine", line)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getActivity(this, line?.hashCode() ?: 0, launch, flags)
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
   *  OverlayView.CircleBitmapDrawable's square-crop + circle clip).
   *
   *  Blocking by design — called on the FCM background dispatch thread so the
   *  bitmap is ready before the notification is posted. Timeouts are short
   *  (4s connect + 4s read) so we stay well under FCM's ~10s thread budget. */
  private fun downloadAndCircleCrop(url: String): Bitmap? {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
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
  }
}
