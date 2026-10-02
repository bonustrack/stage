package box.stage.diagnostics;

import android.app.Application;
import androidx.core.app.CoreComponentFactory;

public final class CrashReportFactory extends CoreComponentFactory {
  @Override
  public Application instantiateApplication(ClassLoader loader, String className)
      throws InstantiationException, IllegalAccessException, ClassNotFoundException {
    if (Application.getProcessName().endsWith(":stage_crash_report")) {
      return new Application();
    }
    return super.instantiateApplication(loader, className);
  }
}
