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
    overlay = OverlayView(
      this,
      onRecordStart = { startRecording() },
      onRecordStop = { commit -> stopRecording(commit) },
      onClose = { closeFromPill() },
      onOpenChat = { openChat() },
    ).also { it.attach() }
  }

  /** Push-to-talk press began (long-press fired). Start the recorder. */
  private fun startRecording() {
    if (recorder?.isRecording == true) return
    val newRec = AudioRecorder(this)
    try {
      newRec.start()
      recorder = newRec
      overlay?.setRecording(true)
    } catch (e: Throwable) {
      recorder = null
      overlay?.setRecording(false)
      MetroPillModule.emit("onError", mapOf("message" to ("record-start-failed: " + (e.message ?: "unknown"))))
    }
  }

  /** Push-to-talk released. `commit` = send the clip; otherwise (slide-to-cancel)
   *  discard it without emitting onRecorded. */
  private fun stopRecording(commit: Boolean) {
    val rec = recorder ?: return
    if (!rec.isRecording) { recorder = null; return }
    val result = rec.stop()
    recorder = null
    overlay?.setRecording(false)
    if (!commit) {
      // Slide-to-cancel: drop the file, send nothing.
      result?.let { runCatching { java.io.File(android.net.Uri.parse(it.uri).path ?: "").delete() } }
      return
    }
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
  }

  /** ✕ from the expanded bar → hide the pill + stop the service (same path as
   *  the JS hidePill()). */
  private fun closeFromPill() {
    teardown()
    stopForegroundCompat()
    stopSelf()
  }

  /** "Open chat" glyph → bring the Metro app to the foreground (launch
   *  MainActivity, the most reliable foreground bring-up from a background
   *  service) and fire onOpenChat so JS routes to the daemon DM. */
  private fun openChat() {
    try {
      val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
      if (launch != null) startActivity(launch)
    } catch (_: Throwable) { /* best-effort foreground */ }
    MetroPillModule.emit("onOpenChat", mapOf<String, Any?>())
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
