const { AndroidConfig, withMainApplication } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
];
const OPTIONS = 'com.oney.WebRTCModule.WebRTCModuleOptions.getInstance()';

function enableProjectionService(contents, language) {
  if (language !== 'kt' && language !== 'java') {
    throw new Error('withCalls: MainApplication must be Kotlin or Java');
  }
  const line = `${OPTIONS}.enableMediaProjectionService = true${language === 'java' ? ';' : ''}`;
  const withoutPrevious = contents.replace(
    /^\s*com\.oney\.WebRTCModule\.WebRTCModuleOptions\.getInstance\(\)\.enableMediaProjectionService\s*=\s*true;?\s*\n/gm,
    '',
  );
  const onCreate = /((?:override\s+fun|public\s+void)\s+onCreate\(\)\s*\{\s*\n[ \t]*super\.onCreate\(\);?)([^\S\n]*)/;
  if (!onCreate.test(withoutPrevious)) {
    throw new Error('withCalls: MainApplication.onCreate initialization point not found');
  }
  return withoutPrevious.replace(onCreate, `$1\n    ${line}$2`);
}

function withCallsAndroid(config) {
  const next = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);
  return withMainApplication(next, (cfg) => {
    cfg.modResults.contents = enableProjectionService(cfg.modResults.contents, cfg.modResults.language);
    return cfg;
  });
}

module.exports = withCallsAndroid;
