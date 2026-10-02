package box.stage.diagnostics;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.graphics.Typeface;
import android.graphics.Insets;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.InputStream;
import java.time.Instant;

public final class CrashReportActivity extends Activity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    int padding = (int) (16 * getResources().getDisplayMetrics().density);
    layout.setOnApplyWindowInsetsListener((view, insets) -> {
      Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
      view.setPadding(padding + bars.left, padding + bars.top, padding + bars.right, padding + bars.bottom);
      return insets;
    });
    TextView intro = new TextView(this);
    intro.setText("Stage crash report\n\nOnly exit reasons and native code frames. No messages, keys, memory or app logs. Nothing is sent automatically. Review before copying.\n");
    layout.addView(intro);
    Button copy = new Button(this);
    copy.setText("Copy report");
    copy.setEnabled(false);
    layout.addView(copy);
    TextView output = new TextView(this);
    output.setTypeface(Typeface.MONOSPACE);
    output.setTextSize(12);
    output.setTextIsSelectable(true);
    output.setText("Reading Android's retained exit records...");
    ScrollView scroll = new ScrollView(this);
    scroll.addView(output);
    layout.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    setContentView(layout);
    new Thread(() -> {
      String report = readReport();
      runOnUiThread(() -> {
        if (isFinishing() || isDestroyed()) return;
        output.setText(report);
        copy.setEnabled(true);
        copy.setOnClickListener(view -> copyReport(report));
      });
    }, "StageCrashReport").start();
  }

  private void copyReport(String report) {
    ClipData clip = ClipData.newPlainText("Stage crash report", report);
    PersistableBundle extras = new PersistableBundle();
    extras.putBoolean("android.content.extra.IS_SENSITIVE", true);
    clip.getDescription().setExtras(extras);
    getSystemService(ClipboardManager.class).setPrimaryClip(clip);
    Toast.makeText(this, "Report copied. Paste it only where you choose.", Toast.LENGTH_LONG).show();
  }

  private String readReport() {
    StringBuilder report = new StringBuilder("Stage Android exit report v1\n");
    report.append("Android API: ").append(Build.VERSION.SDK_INT).append('\n');
    report.append("Package: ").append(getPackageName()).append('\n');
    try {
      PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
      report.append("Installed version: ").append(info.versionName).append(" (")
          .append(info.getLongVersionCode()).append(")\n");
      report.append("APK updated: ").append(Instant.ofEpochMilli(info.lastUpdateTime)).append('\n');
      report.append("Retained exits may predate this APK. The selected OTA is not read.\n\n");
      ActivityManager manager = getSystemService(ActivityManager.class);
      int count = 0;
      int traces = 0;
      for (ApplicationExitInfo exit : manager.getHistoricalProcessExitReasons(getPackageName(), 0, 32)) {
        if (!getPackageName().equals(exit.getProcessName())) continue;
        if (count++ == 8) break;
        report.append(Instant.ofEpochMilli(exit.getTimestamp())).append('\n');
        report.append("Reason: ").append(reason(exit.getReason())).append(" (")
            .append(exit.getReason()).append("); status: ").append(exit.getStatus()).append('\n');
        report.append("Last sampled PSS/RSS kB: ").append(exit.getPss()).append('/')
            .append(exit.getRss()).append("; importance: ").append(exit.getImportance()).append('\n');
        if (exit.getReason() == ApplicationExitInfo.REASON_CRASH_NATIVE && traces++ < 2) {
          appendTrace(report, exit);
        }
        report.append('\n');
      }
      if (count == 0) report.append("Android returned no retained exits for the normal Stage process.\n");
    } catch (Exception error) {
      report.append("Could not read retained exit records: ").append(error.getClass().getSimpleName()).append('\n');
    }
    report.append("Raw abort text, thread names, registers, memory, paths and logs are omitted.\n");
    return report.toString();
  }

  private static void appendTrace(StringBuilder report, ApplicationExitInfo exit) {
    if (Build.VERSION.SDK_INT < 31) {
      report.append("Native trace requires Android 12 or newer.\n");
      return;
    }
    try (InputStream trace = exit.getTraceInputStream()) {
      if (trace == null) report.append("Android no longer retains the native trace.\n");
      else report.append(NativeTombstone.read(trace));
    } catch (Exception error) {
      report.append("Native trace unavailable or unreadable: ").append(error.getClass().getSimpleName()).append('\n');
    }
  }

  private static String reason(int reason) {
    switch (reason) {
      case ApplicationExitInfo.REASON_CRASH: return "Java/managed crash";
      case ApplicationExitInfo.REASON_CRASH_NATIVE: return "Native crash";
      case ApplicationExitInfo.REASON_ANR: return "Not responding";
      case ApplicationExitInfo.REASON_LOW_MEMORY: return "Low memory";
      case ApplicationExitInfo.REASON_SIGNALED: return "Signal";
      case ApplicationExitInfo.REASON_EXIT_SELF: return "Self exit";
      case ApplicationExitInfo.REASON_USER_REQUESTED: return "User/system stop";
      case ApplicationExitInfo.REASON_USER_STOPPED: return "User stopped";
      case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: return "Initialization failure";
      case ApplicationExitInfo.REASON_DEPENDENCY_DIED: return "Dependency died";
      default: return "Other/unknown";
    }
  }
}
