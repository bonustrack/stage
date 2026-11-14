const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SERVICES = [
  'box.stage.calls.StageCallService',
  'com.oney.WebRTCModule.MediaProjectionService',
  'expo.modules.location.services.LocationTaskService',
];

function removeServices(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const kept = (app.service ?? []).filter((service) => !SERVICES.includes(service.$['android:name']));
  app.service = [...kept, ...SERVICES.map((name) => ({ $: { 'android:name': name, 'tools:node': 'remove' } }))];
  return manifest;
}

function withNoForegroundServices(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = removeServices(cfg.modResults);
    return cfg;
  });
}

module.exports = withNoForegroundServices;
module.exports.removeServices = removeServices;
