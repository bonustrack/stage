const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const { configureExtension, TARGET, SOURCES, RESOURCES, INFO_PLIST, ENTITLEMENTS } = require('./xcode');

const APP_GROUPS = 'com.apple.security.application-groups';

function plistXml(body) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    body,
    '</dict></plist>',
    '',
  ].join('\n');
}

function extensionPlist(group) {
  return plistXml([
    '  <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>',
    '  <key>CFBundleDisplayName</key><string>Stage Screen Share</string>',
    '  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>',
    '  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>',
    '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>',
    '  <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>',
    '  <key>CFBundlePackageType</key><string>XPC!</string>',
    '  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>',
    '  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>',
    `  <key>RTCAppGroupIdentifier</key><string>${group}</string>`,
    '  <key>NSExtension</key><dict>',
    '    <key>NSExtensionPointIdentifier</key><string>com.apple.broadcast-services-upload</string>',
    '    <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).SampleHandler</string>',
    '    <key>RPBroadcastProcessMode</key><string>RPBroadcastProcessModeSampleBuffer</string>',
    '  </dict>',
  ].join('\n'));
}

function withExtensionAssets(config, group) {
  return withDangerousMod(config, ['ios', (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of [...SOURCES, ...RESOURCES]) fs.copyFileSync(path.join(__dirname, name), path.join(dir, name));
    fs.writeFileSync(path.join(dir, INFO_PLIST), extensionPlist(group));
    fs.writeFileSync(path.join(dir, ENTITLEMENTS), plistXml(`  <key>${APP_GROUPS}</key><array><string>${group}</string></array>`));
    return cfg;
  }]);
}

function withExtensionMetadata(config, bundleIdentifier, group) {
  const extra = config.extra || {};
  const eas = extra.eas || {};
  const build = eas.build || {};
  const experimental = build.experimental || {};
  const ios = experimental.ios || {};
  const appExtensions = (ios.appExtensions || []).filter((entry) => entry.targetName !== TARGET);
  appExtensions.push({ targetName: TARGET, bundleIdentifier, entitlements: { [APP_GROUPS]: [group] } });
  return {
    ...config,
    extra: {
      ...extra,
      eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: { ...ios, appExtensions } } } },
    },
  };
}

function withCallsIos(config) {
  const bundleId = config.ios && config.ios.bundleIdentifier;
  if (!bundleId || !/^[A-Za-z0-9.-]+$/.test(bundleId)) throw new Error('withCalls: a valid ios.bundleIdentifier is required');
  const group = `group.${bundleId}`;
  const bundleIdentifier = `${bundleId}.${TARGET}`;
  let next = withExtensionMetadata(config, bundleIdentifier, group);
  next = withEntitlementsPlist(next, (cfg) => {
    cfg.modResults[APP_GROUPS] = [...new Set([...(cfg.modResults[APP_GROUPS] || []), group])];
    return cfg;
  });
  next = withInfoPlist(next, (cfg) => {
    cfg.modResults.RTCAppGroupIdentifier = group;
    cfg.modResults.RTCScreenSharingExtension = bundleIdentifier;
    cfg.modResults.UIBackgroundModes = [...new Set([...(cfg.modResults.UIBackgroundModes || []), 'audio'])];
    return cfg;
  });
  next = withExtensionAssets(next, group);
  return withXcodeProject(next, (cfg) => {
    configureExtension(cfg.modResults, cfg, bundleIdentifier);
    return cfg;
  });
}

module.exports = withCallsIos;
