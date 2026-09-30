const TARGET = 'StageScreenShare';
const SOURCES = ['SampleHandler.swift', 'SampleUploader.swift', 'SocketConnection.swift', 'DarwinNotificationCenter.swift'];
const RESOURCES = ['Jitsi-LICENSE.txt', 'Jitsi-NOTICES.txt'];
const INFO_PLIST = `${TARGET}-Info.plist`;
const ENTITLEMENTS = `${TARGET}.entitlements`;
const FRAMEWORKS = ['ReplayKit', 'Foundation', 'CoreMedia', 'CoreVideo', 'CoreImage', 'ImageIO', 'CFNetwork'];

function unquote(value) {
  return String(value || '').replace(/^"|"$/g, '');
}

function ensureGroup(project) {
  const existing = project.findPBXGroupKey({ name: TARGET });
  if (existing) return { uuid: existing, pbxGroup: project.getPBXGroupByKey(existing) };
  const group = project.addPbxGroup([], TARGET, TARGET);
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  return group;
}

function ensureFile(project, group, name) {
  const references = project.pbxFileReferenceSection();
  const child = group.pbxGroup.children.find((entry) => unquote(references[entry.value]?.path) === name);
  if (child) return child.value;
  const uuid = project.generateUuid();
  const fileTypes = { swift: 'sourcecode.swift', plist: 'text.plist.xml', entitlements: 'text.plist.entitlements' };
  const suffix = name.split('.').at(-1);
  references[uuid] = { isa: 'PBXFileReference', path: `"${name}"`, sourceTree: '"<group>"', lastKnownFileType: fileTypes[suffix] || 'text' };
  references[`${uuid}_comment`] = name;
  group.pbxGroup.children.push({ value: uuid, comment: name });
  return uuid;
}

function ensurePhase(project, target, type, name) {
  const sections = project.hash.project.objects;
  const existing = target.pbxNativeTarget.buildPhases.find((entry) => sections[type]?.[entry.value]);
  if (existing) return sections[type][existing.value];
  return project.addBuildPhase([], type, name, target.uuid).buildPhase;
}

function ensureBuildFile(project, phase, fileRef, name, settings) {
  const files = project.pbxBuildFileSection();
  const existing = phase.files.find((entry) => files[entry.value]?.fileRef === fileRef);
  if (existing) {
    if (settings) files[existing.value].settings = settings;
    return;
  }
  const uuid = project.generateUuid();
  files[uuid] = { isa: 'PBXBuildFile', fileRef, fileRef_comment: name };
  if (settings) files[uuid].settings = settings;
  files[`${uuid}_comment`] = name;
  phase.files.push({ value: uuid, comment: name });
}

function frameworkReference(project, name) {
  const fileName = `${name}.framework`;
  const references = project.pbxFileReferenceSection();
  const existing = Object.entries(references).find(([, entry]) => entry && typeof entry === 'object' && unquote(entry.path).endsWith(fileName));
  if (existing) return existing[0];
  const uuid = project.generateUuid();
  references[uuid] = { isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework', name: `"${fileName}"`, path: `"System/Library/Frameworks/${fileName}"`, sourceTree: 'SDKROOT' };
  references[`${uuid}_comment`] = fileName;
  let group = project.findPBXGroupKey({ name: 'Frameworks' });
  if (!group) {
    group = project.addPbxGroup([], 'Frameworks').uuid;
    project.addToPbxGroup(group, project.getFirstProject().firstProject.mainGroup);
  }
  project.getPBXGroupByKey(group).children.push({ value: uuid, comment: fileName });
  return uuid;
}

function findTarget(project) {
  return Object.entries(project.pbxNativeTargetSection()).find(([, entry]) => entry && typeof entry === 'object' && unquote(entry.name) === TARGET);
}

function ensureTarget(project, bundleIdentifier) {
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ||= {};
  objects.PBXContainerItemProxy ||= {};
  const existing = findTarget(project);
  if (existing) return { uuid: existing[0], pbxNativeTarget: existing[1] };
  return project.addTarget(TARGET, 'app_extension', TARGET, bundleIdentifier);
}

function embedExtension(project, target) {
  const app = project.getFirstTarget();
  const objects = project.hash.project.objects;
  const phases = objects.PBXCopyFilesBuildPhase ||= {};
  let reference = app.firstTarget.buildPhases.find((entry) => String(phases[entry.value]?.dstSubfolderSpec) === '13');
  if (!reference) {
    const added = project.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed App Extensions', app.uuid, 'app_extension');
    reference = app.firstTarget.buildPhases.find((entry) => entry.value === added.uuid);
  }
  const phase = phases[reference.value];
  reference.comment = 'Embed App Extensions';
  phases[`${reference.value}_comment`] = 'Embed App Extensions';
  phase.name = '"Embed App Extensions"';
  ensureBuildFile(project, phase, target.pbxNativeTarget.productReference, `${TARGET}.appex`, { ATTRIBUTES: ['RemoveHeadersOnCopy'] });
  const unused = app.firstTarget.buildPhases.filter((entry) => entry.value !== reference.value && String(phases[entry.value]?.dstSubfolderSpec) === '13' && phases[entry.value].files.length === 0);
  for (const entry of unused) {
    app.firstTarget.buildPhases = app.firstTarget.buildPhases.filter((item) => item.value !== entry.value);
    Reflect.deleteProperty(phases, entry.value);
    Reflect.deleteProperty(phases, `${entry.value}_comment`);
  }
  const dependencies = objects.PBXTargetDependency;
  if (!app.firstTarget.dependencies.some((entry) => dependencies[entry.value]?.target === target.uuid)) project.addTargetDependency(app.uuid, [target.uuid]);
}

function targetConfigurations(project, target) {
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  return list.buildConfigurations.map((entry) => project.pbxXCBuildConfigurationSection()[entry.value]);
}

function applySettings(project, target, config, bundleIdentifier) {
  const appSettings = targetConfigurations(project, project.getFirstTarget().firstTarget)[0].buildSettings;
  const deploymentTarget = unquote(appSettings.IPHONEOS_DEPLOYMENT_TARGET) || '15.1';
  const settings = {
    APPLICATION_EXTENSION_API_ONLY: 'YES',
    CLANG_ENABLE_MODULES: 'YES',
    CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${ENTITLEMENTS}"`,
    CODE_SIGN_STYLE: 'Automatic',
    CURRENT_PROJECT_VERSION: config.ios.buildNumber || unquote(appSettings.CURRENT_PROJECT_VERSION) || '1',
    GENERATE_INFOPLIST_FILE: 'NO',
    INFOPLIST_FILE: `"${TARGET}/${INFO_PLIST}"`,
    IPHONEOS_DEPLOYMENT_TARGET: deploymentTarget,
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    MARKETING_VERSION: config.version || unquote(appSettings.MARKETING_VERSION) || '1.0',
    PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
    PRODUCT_NAME: `"${TARGET}"`,
    SKIP_INSTALL: 'YES',
    SWIFT_VERSION: '5.0',
    TARGETED_DEVICE_FAMILY: '"1,2"',
  };
  if (appSettings.DEVELOPMENT_TEAM) settings.DEVELOPMENT_TEAM = appSettings.DEVELOPMENT_TEAM;
  for (const entry of targetConfigurations(project, target.pbxNativeTarget)) {
    Object.assign(entry.buildSettings, settings);
    entry.buildSettings.SWIFT_OPTIMIZATION_LEVEL = unquote(entry.name) === 'Debug' ? '"-Onone"' : '"-O"';
  }
}

function configureExtension(project, config, bundleIdentifier) {
  const target = ensureTarget(project, bundleIdentifier);
  const group = ensureGroup(project);
  const sourcePhase = ensurePhase(project, target, 'PBXSourcesBuildPhase', 'Sources');
  const resourcePhase = ensurePhase(project, target, 'PBXResourcesBuildPhase', 'Resources');
  const frameworkPhase = ensurePhase(project, target, 'PBXFrameworksBuildPhase', 'Frameworks');
  for (const name of SOURCES) ensureBuildFile(project, sourcePhase, ensureFile(project, group, name), name);
  for (const name of RESOURCES) ensureBuildFile(project, resourcePhase, ensureFile(project, group, name), name);
  for (const name of [INFO_PLIST, ENTITLEMENTS]) ensureFile(project, group, name);
  for (const name of FRAMEWORKS) ensureBuildFile(project, frameworkPhase, frameworkReference(project, name), `${name}.framework`);
  embedExtension(project, target);
  applySettings(project, target, config, bundleIdentifier);
}

module.exports = { configureExtension, TARGET, SOURCES, RESOURCES, INFO_PLIST, ENTITLEMENTS };
