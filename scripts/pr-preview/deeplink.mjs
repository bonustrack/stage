/**
 * deeplink.mjs — turn `eas update --json` output into the dev-client deep link
 * + manifest URL. Shared by eas-deeplink.mjs (CLI/Actions) and daemon-watcher.mjs.
 *
 * The dev-client loads a specific EAS Update group via:
 *   <scheme>://expo-development-client/?url=https://u.expo.dev/<projectId>/group/<groupId>
 * (see docs.expo.dev/eas-update/expo-dev-client).
 */
const SCHEME = 'metro'; // dev variant scheme (app.config.js). Prod = 'stage'.
const DEFAULT_PROJECT_ID = '1707f2db-c2b8-4c91-9341-27b1d57d355f';

/** @returns {{ manifest: string, deeplink: string, group: string, projectId: string }} */
export function buildPreviewLinks(raw) {
  // `eas update --json` emits an array of per-platform update records (one per
  // platform published). They share a groupId. Tolerate object or array shape.
  const records = Array.isArray(raw) ? raw : (raw.updates ?? [raw]);
  const rec = records.find((r) => r?.group) ?? records[0];
  const group = rec?.group;
  const projectId = rec?.projectId ?? rec?.project?.id ?? DEFAULT_PROJECT_ID;
  if (!group) {
    throw new Error(`eas-deeplink: no group id in eas update output: ${JSON.stringify(raw).slice(0, 500)}`);
  }
  const manifest = `https://u.expo.dev/${projectId}/group/${group}`;
  const deeplink = `${SCHEME}://expo-development-client/?url=${encodeURIComponent(manifest)}`;
  return { manifest, deeplink, group, projectId };
}
