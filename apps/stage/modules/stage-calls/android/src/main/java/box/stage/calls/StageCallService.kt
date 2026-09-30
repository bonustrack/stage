package box.stage.calls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder

class StageCallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Calls", NotificationManager.IMPORTANCE_LOW))
    val builder = Notification.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.sym_call_incoming)
      .setContentTitle("Stage call")
      .setContentText("Microphone is in use")
      .setCategory(Notification.CATEGORY_CALL)
      .setOngoing(true)
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    val video = intent?.getBooleanExtra("video", false) == true
    val type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or if (video) ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA else 0
    startForeground(NOTIFICATION, builder.build(), type)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    private const val CHANNEL = "stage-calls"
    private const val NOTIFICATION = 6401
  }
}
