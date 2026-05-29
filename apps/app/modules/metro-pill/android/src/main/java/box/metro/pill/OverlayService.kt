package box.metro.pill

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service that owns the floating overlay pill and the audio
 * recorder. Runs as a microphone-typed FGS so recording survives the RN
 * Activity being backgrounded.
 *
 * Recording is strictly tap-initiated (from the pill) — this is the only
 * Android-14-legal way to start a mic FGS, since starting one with no recent
 * user interaction throws ForegroundServiceStartNotAllowedException.
 */
class OverlayService : Service() {
  private var overlay: OverlayView? = null
  private var recorder: AudioRecorder? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.getStringExtra(EXTRA_ACTION)) {
      ACTION_HIDE -> {
        teardown()
        stopForegroundCompat()
        stopSelf()
        return START_NOT_STICKY
      }
      else -> {
        startForegroundNotification()
        showOverlay()
      }
    }
    return START_STICKY
  }

  private fun startForegroundNotification() {
    val channelId = "metro-pill-fgs"
    if (Build.VERSION.SDK_INT >= 26) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(channelId) == null) {
        nm.createNotificationChannel(
          NotificationChannel(channelId, "Voice pill", NotificationManager.IMPORTANCE_LOW),
        )
      }
    }
    val notif: Notification = androidx.core.app.NotificationCompat.Builder(this, channelId)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Metro voice pill")
      .setContentText("Tap the floating button to record")
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= 30) {
      startForeground(FGS_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    } else {
      startForeground(FGS_ID, notif)
    }
  }

  private fun showOverlay() {
    if (overlay != null) return
    overlay = OverlayView(this) { tapAction() }.also { it.attach() }
  }

  /** Pill tap: toggles recording. First tap starts, second tap stops + emits. */
  private fun tapAction() {
    MetroPillModule.emit("onPillTapped", mapOf<String, Any?>())
    val rec = recorder
    if (rec != null && rec.isRecording) {
      val result = rec.stop()
      recorder = null
      overlay?.setRecording(false)
      if (result != null) {
        MetroPillModule.emit(
          "onRecorded",
          mapOf(
            "uri" to result.uri,
            "durationMs" to result.durationMs,
            "mimeType" to "audio/m4a",
          ),
        )
      } else {
        MetroPillModule.emit("onError", mapOf("message" to "recording-empty"))
      }
    } else {
      val newRec = AudioRecorder(this)
      try {
        newRec.start()
        recorder = newRec
        overlay?.setRecording(true)
      } catch (e: Throwable) {
        MetroPillModule.emit("onError", mapOf("message" to ("record-start-failed: " + (e.message ?: "unknown"))))
      }
    }
  }

  private fun teardown() {
    try { recorder?.stop() } catch (_: Throwable) {}
    recorder = null
    overlay?.detach()
    overlay = null
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= 24) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  override fun onDestroy() {
    teardown()
    isRunning = false
    super.onDestroy()
  }

  companion object {
    const val EXTRA_ACTION = "action"
    const val ACTION_SHOW = "show"
    const val ACTION_HIDE = "hide"
    private const val FGS_ID = 4711

    @Volatile
    var isRunning: Boolean = false
      private set
  }
}
