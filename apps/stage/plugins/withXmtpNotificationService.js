const fs = require('node:fs');
const path = require('node:path');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withPodfile,
  withXcodeProject,
} = require('expo/config-plugins');

const TARGET = 'StageNotificationService';
const SWIFT_FILE = 'NotificationService.swift';
const INFO_PLIST = `${TARGET}-Info.plist`;
const ENTITLEMENTS = `${TARGET}.entitlements`;
const SWIFT_SOURCE = path.join(__dirname, 'notificationService', SWIFT_FILE);
const DEPLOYMENT_TARGET = '15.1';
const APP_GROUPS_KEY = 'com.apple.security.application-groups';

function appGroupOf(bundleId) {
  return `group.${bundleId}`;
}

function extensionBundleIdOf(bundleId) {
  return `${bundleId}.${TARGET}`;
}

function xmtpPodVersion(projectRoot) {
  const podspec = require.resolve('@xmtp/react-native-sdk/ios/XMTPReactNative.podspec', { paths: [projectRoot] });
  const match = fs.readFileSync(podspec, 'utf8').match(/dependency\s+"XMTP",\s+"=\s*([^"]+)"/);
  if (!match || !match[1]) throw new Error('withXmtpNotificationService: XMTP pod version not found in the RN SDK podspec');
  return match[1].trim();
}

function plistXml(body) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    body,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

function infoPlist(group) {
  return plistXml([
    '  <key>CFBundleDevelopmentRegion</key><string>$(DEVELOPMENT_LANGUAGE)</string>',
    `  <key>CFBundleDisplayName</key><string>${TARGET}</string>`,
    '  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>',
    '  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>',
    '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>',
    '  <key>CFBundleName</key><string>$(PRODUCT_NAME)</string>',
    '  <key>CFBundlePackageType</key><string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>',
    '  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>',
    '  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>',
    `  <key>StageAppGroup</key><string>${group}</string>`,
    '  <key>NSExtension</key>',
    '  <dict>',
    '    <key>NSExtensionPointIdentifier</key><string>com.apple.usernotifications.service</string>',
    '    <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).NotificationService</string>',
    '  </dict>',
  ].join('\n'));
}

function entitlementsPlist(group) {
  return plistXml([
    `  <key>${APP_GROUPS_KEY}</key>`,
    `  <array><string>${group}</string></array>`,
  ].join('\n'));
}

function withAppGroupEntitlement(config, group) {
  return withEntitlementsPlist(config, (cfg) => {
    const groups = cfg.modResults[APP_GROUPS_KEY] || [];
    if (!groups.includes(group)) cfg.modResults[APP_GROUPS_KEY] = [...groups, group];
    return cfg;
  });
}

function withRemoteNotificationBackgroundMode(config) {
  return withInfoPlist(config, (cfg) => {
    const modes = cfg.modResults.UIBackgroundModes || [];
    if (!modes.includes('remote-notification')) cfg.modResults.UIBackgroundModes = [...modes, 'remote-notification'];
    return cfg;
  });
}

function withExtensionFiles(config, group) {
  return withDangerousMod(config, ['ios', (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(SWIFT_SOURCE, path.join(dir, SWIFT_FILE));
    fs.writeFileSync(path.join(dir, INFO_PLIST), infoPlist(group));
    fs.writeFileSync(path.join(dir, ENTITLEMENTS), entitlementsPlist(group));
    return cfg;
  }]);
}

function withExtensionPod(config) {
  return withPodfile(config, (cfg) => {
    if (cfg.modResults.contents.includes(`target '${TARGET}'`)) return cfg;
    const version = xmtpPodVersion(cfg.modRequest.projectRoot);
    cfg.modResults.contents += `\ntarget '${TARGET}' do\n  pod 'XMTP', '= ${version}'\nend\n`;
    return cfg;
  });
}

function extensionBuildSettings(bundleId, config) {
  return {
    CODE_SIGN_ENTITLEMENTS: `${TARGET}/${ENTITLEMENTS}`,
    CODE_SIGN_STYLE: 'Automatic',
    CURRENT_PROJECT_VERSION: config.ios.buildNumber || '1',
    GENERATE_INFOPLIST_FILE: 'NO',
    IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
    MARKETING_VERSION: config.version,
    PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundleIdOf(bundleId)}"`,
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '"1,2"',
  };
}

function attachGroupToMainGroup(project, groupUuid) {
  const mainGroupUuid = project.getFirstProject().firstProject.mainGroup;
  project.addToPbxGroup(groupUuid, mainGroupUuid);
}

function ensureSections(project) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency = objects.PBXTargetDependency || {};
  objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};
}

function applyBuildSettings(project, settings) {
  const configs = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configs)) {
    const entry = configs[key];
    if (entry && entry.buildSettings && entry.buildSettings.PRODUCT_NAME === `"${TARGET}"`) {
      Object.assign(entry.buildSettings, settings);
    }
  }
}

function hasTarget(project) {
  const targets = project.pbxNativeTargetSection();
  return Object.values(targets).some((t) => t && typeof t === 'object' && String(t.name).replace(/"/g, '') === TARGET);
}

function withExtensionTarget(config, bundleId) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    if (hasTarget(project)) return cfg;
    ensureSections(project);
    const group = project.addPbxGroup([SWIFT_FILE, INFO_PLIST, ENTITLEMENTS], TARGET, TARGET);
    attachGroupToMainGroup(project, group.uuid);
    const target = project.addTarget(TARGET, 'app_extension', TARGET, extensionBundleIdOf(bundleId));
    project.addBuildPhase([SWIFT_FILE], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    applyBuildSettings(project, extensionBuildSettings(bundleId, cfg));
    return cfg;
  });
}

function withEasExtensionCredentials(config, bundleId, group) {
  const extra = config.extra || {};
  const eas = extra.eas || {};
  const build = eas.build || {};
  const experimental = build.experimental || {};
  const ios = experimental.ios || {};
  const others = (ios.appExtensions || []).filter((e) => e.targetName !== TARGET);
  const appExtensions = [
    ...others,
    {
      targetName: TARGET,
      bundleIdentifier: extensionBundleIdOf(bundleId),
      entitlements: { [APP_GROUPS_KEY]: [group] },
    },
  ];
  return {
    ...config,
    extra: {
      ...extra,
      eas: { ...eas, build: { ...build, experimental: { ...experimental, ios: { ...ios, appExtensions } } } },
    },
  };
}

function withXmtpNotificationService(config) {
  const bundleId = config.ios && config.ios.bundleIdentifier;
  if (!bundleId) throw new Error('withXmtpNotificationService: ios.bundleIdentifier is required');
  const group = appGroupOf(bundleId);
  let next = withEasExtensionCredentials(config, bundleId, group);
  next = withAppGroupEntitlement(next, group);
  next = withRemoteNotificationBackgroundMode(next);
  next = withExtensionFiles(next, group);
  next = withExtensionPod(next);
  return withExtensionTarget(next, bundleId);
}

module.exports = withXmtpNotificationService;
