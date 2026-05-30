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
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
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
 * OverlayView.CircleBitmapDrawable), and posts a NotificationCompat built from
 * custom RemoteViews (notif_message / notif_message_big) that place the round
 * sender avatar on the LEFT, so it renders like Telegram on the collapsed card
 * (setLargeIcon alone lands top-right on Samsung OneUI, and MessagingStyle only
 * shows the avatar left when expanded). Falls back to a standard card +
 * setLargeIcon-free BigTextStyle if the avatar fails to download.
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
      // AVATAR ON THE LEFT (Telegram-style). The standard setLargeIcon renders
      // the avatar top-RIGHT on Samsung OneUI, and MessagingStyle only puts the
      // avatar left on the EXPANDED card. So we drive the layout ourselves with
      // custom RemoteViews that place the round avatar (pre-circle-cropped
      // bitmap) on the left, with title + body to its right. DecoratedCustomView
      // keeps system chrome (app name, timestamp, expand chevron) + theme.
      val collapsed = RemoteViews(packageName, R.layout.notif_message).apply {
        setImageViewBitmap(R.id.metro_notif_avatar, avatar)
        setTextViewText(R.id.metro_notif_title, title)
        setTextViewText(R.id.metro_notif_body, body)
      }
      val expanded = RemoteViews(packageName, R.layout.notif_message_big).apply {
        setImageViewBitmap(R.id.metro_notif_avatar, avatar)
        setTextViewText(R.id.metro_notif_title, title)
        setTextViewText(R.id.metro_notif_body, body)
      }
      builder
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(collapsed)
        .setCustomBigContentView(expanded)
    } else {
      // DEFENSIVE FALLBACK: avatar download failed — post a standard card so a
      // notification still shows (avatar would have rendered top-right here).
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
  }
}
