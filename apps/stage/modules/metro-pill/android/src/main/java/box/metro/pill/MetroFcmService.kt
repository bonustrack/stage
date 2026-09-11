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
 * Receives the contentless pushes sent by the Stage push server (XMTP's
 * reference notification server, see apps/push). The server subscribes to the
 * XMTP topics this installation registered and forwards each envelope as a
 * data-only FCM message:
 *
 *   data: { topic, encryptedMessage, messageType, payloadFormat, topicBytesB64 }
 *
 * The envelope is MLS ciphertext the server cannot read; this service never
 * decrypts it either. It derives the conversation from the topic
 * (`/xmtp/mls/1/g-<groupId>/proto`), wakes the JS layer so the live stream
 * resyncs, and posts a generic "New message" card that deep-links into the
 * conversation, where the app decrypts and renders for real. Welcome topics
 * (`/xmtp/mls/1/w-<installationId>/proto`) only wake JS: a new invitation lands
 * in the requests tab and does not deserve a card.
 *
 * Pushes without a `topic` are not ours and are forwarded to Expo's own
 * FirebaseMessagingService so expo-notifications keeps working. This service is
 * the only MESSAGING_EVENT receiver in the merged manifest (see withMetroPill).
 */
class MetroFcmService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    runCatching { delegateNewToken(token) }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    val topic = data[KEY_TOPIC]?.takeIf { it.isNotBlank() }
    if (topic == null) {
      runCatching { delegateMessage(message) }
      return
    }

    val convId = groupIdOfTopic(topic)
    runCatching {
      MetroPillModule.emit(
        "onXmtpPush",
        mapOf("topic" to topic, "convId" to convId, "messageId" to null),
      )
    }

    if (convId == null) return

    val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (prefs.getBoolean(KEY_APP_FOREGROUND, false)) return
    if (prefs.getString(KEY_ACTIVE_CONV, null) == convId) return

    ensureChannel(DEFAULT_CHANNEL_ID)
    val body = "New message"
    val builder = NotificationCompat.Builder(this, DEFAULT_CHANNEL_ID)
      .setSmallIcon(smallIconRes())
      .setContentTitle("Stage")
      .setContentText(body)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(contentIntent(convId))

    if (NotificationManagerCompat.from(this).areNotificationsEnabled()) {
      try {
        NotificationManagerCompat.from(this).notify(convId.hashCode(), builder.build())
      } catch (_: SecurityException) {
      }
    }
  }

  /** `/xmtp/mls/1/g-<groupId>/proto` → lower-case group id; null for any other topic. */
  private fun groupIdOfTopic(topic: String): String? {
    val match = GROUP_TOPIC.find(topic) ?: return null
    return match.groupValues.getOrNull(1)?.lowercase()?.takeIf { it.isNotBlank() }
  }

  /** Tap → `stage://<convId>`, which expo-router maps to the conversation screen
   *  on both cold start and warm tap without any JS listener. */
  private fun contentIntent(convId: String): PendingIntent {
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    val view = Intent(Intent.ACTION_VIEW, Uri.parse("$APP_SCHEME://$convId")).apply {
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

  private fun smallIconRes(): Int {
    val byName = resources.getIdentifier("notification_icon", "drawable", packageName)
    if (byName != 0) return byName
    return applicationInfo.icon
  }

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
    private const val APP_SCHEME = "stage"
    private const val KEY_TOPIC = "topic"
    private val GROUP_TOPIC = Regex("/g-([0-9a-fA-F]+)/")

    private const val PREFS_NAME = "metro_pill"
    private const val KEY_ACTIVE_CONV = "active_conv"
    private const val KEY_APP_FOREGROUND = "app_foreground"
  }
}
