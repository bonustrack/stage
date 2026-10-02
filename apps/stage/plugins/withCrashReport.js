const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const FACTORY = 'box.stage.diagnostics.CrashReportFactory';
const ACTIVITY = 'box.stage.diagnostics.CrashReportActivity';

function withCrashReport(config) {
  const next = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const factory = app.$['android:appComponentFactory'];
    if (factory && factory !== FACTORY && factory !== 'androidx.core.app.CoreComponentFactory') {
      throw new Error('Crash report cannot replace an unknown app component factory');
    }
    app.$['android:appComponentFactory'] = FACTORY;
    const replace = new Set((app.$['tools:replace'] || '').split(',').map((s) => s.trim()).filter(Boolean));
    replace.add('android:appComponentFactory');
    app.$['tools:replace'] = [...replace].join(',');
    app.activity = (app.activity || []).filter((activity) => activity.$['android:name'] !== ACTIVITY);
    app.activity.push({
      $: {
        'android:name': ACTIVITY,
        'android:label': 'Stage crash report',
        'android:exported': 'true',
        'android:process': ':stage_crash_report',
        'android:taskAffinity': `${cfg.android.package}.crashreport`,
        'android:excludeFromRecents': 'true',
        'android:theme': '@android:style/Theme.Material.Light.NoActionBar',
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      }],
    });
    return cfg;
  });
  return withDangerousMod(next, ['android', async (cfg) => {
    const target = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java/box/stage/diagnostics');
    await fs.mkdir(target, { recursive: true });
    for (const name of ['CrashReportFactory.java', 'CrashReportActivity.java', 'NativeTombstone.java']) {
      await fs.copyFile(path.join(__dirname, 'crash-report', name), path.join(target, name));
    }
    return cfg;
  }]);
}

module.exports = withCrashReport;
