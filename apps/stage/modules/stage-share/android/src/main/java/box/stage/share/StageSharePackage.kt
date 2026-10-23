package box.stage.share

import android.app.Application
import android.content.Context
import android.content.Intent
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

class StageSharePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> {
    return listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        application.registerActivityLifecycleCallbacks(ShareActivityLifecycle())
      }
    })
  }

  companion object {
    fun receive(context: Context, intent: Intent) {
      StageShareInbox.receive(context, intent)
    }
  }
}
