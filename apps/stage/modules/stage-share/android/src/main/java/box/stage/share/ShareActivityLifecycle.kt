package box.stage.share

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.facebook.react.ReactActivity

internal class ShareActivityLifecycle : Application.ActivityLifecycleCallbacks {
  override fun onActivityPreCreated(activity: Activity, savedInstanceState: Bundle?) {
    if (activity !is ReactActivity) return
    if (savedInstanceState == null) StageShareInbox.receive(activity, activity.intent)
    else StageShareInbox.restore(activity.intent)
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
  override fun onActivityStarted(activity: Activity) = Unit
  override fun onActivityResumed(activity: Activity) = Unit
  override fun onActivityPaused(activity: Activity) = Unit
  override fun onActivityStopped(activity: Activity) = Unit
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
  override fun onActivityDestroyed(activity: Activity) = Unit
}
