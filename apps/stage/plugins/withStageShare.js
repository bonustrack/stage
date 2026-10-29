const { withMainActivity } = require('expo/config-plugins');

const CAPTURE = 'box.stage.share.StageSharePackage.receive(this, intent)';

function captureNewIntents(source) {
  if (source.includes(CAPTURE)) return source;
  if (/override fun onNewIntent\(/.test(source)) {
    const updated = source.replace(/super\.onNewIntent\(intent\)/, `${CAPTURE}\n    super.onNewIntent(intent)`);
    if (updated === source) throw new Error('Stage share needs a supported MainActivity.onNewIntent.');
    return updated;
  }
  const method = `\n  override fun onNewIntent(intent: android.content.Intent) {\n    ${CAPTURE}\n    super.onNewIntent(intent)\n  }\n`;
  const updated = source.replace(
    /\n\s*override fun createReactActivityDelegate\(/,
    `${method}\n  override fun createReactActivityDelegate(`,
  );
  if (updated === source) throw new Error('Stage share needs a supported Kotlin MainActivity.');
  return updated;
}

function withStageShare(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') throw new Error('Stage share requires Kotlin MainActivity.');
    cfg.modResults.contents = captureNewIntents(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withStageShare;
module.exports.captureNewIntents = captureNewIntents;
