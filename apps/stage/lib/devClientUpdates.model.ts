import { BUNDLER_ORIGIN, EAS_UPDATES_URL, PREVIEW_LAUNCHER_PATH } from '@stage-labs/client/endpoints';
const PROJECT_URL = EAS_UPDATES_URL;
const STATUS_URL = 'https://api.github.com/repos/bonustrack/stage/commits';
const SHA = /^[0-9a-f]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface PreviewManifest {
  id: string;
  runtime: string;
  gitHash: string;
}

export interface MainUpdate extends PreviewManifest {
  url: string;
  latest: PreviewManifest;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function isDevClientLauncher(debugMarker: unknown, launcher: unknown): boolean {
  return Boolean(debugMarker) && typeof record(launcher).loadApp === 'function';
}

export function loadedCommit(manifest: unknown): string | null {
  const extra = record(record(record(manifest).extra).expoClient).extra;
  const gitHash = record(extra).gitHash;
  return typeof gitHash === 'string' && SHA.test(gitHash) ? gitHash : null;
}

function manifestIdentity(value: unknown): PreviewManifest {
  const data = record(value);
  const gitHash = loadedCommit(value);
  if (
    typeof data.id !== 'string' ||
    !UUID.test(data.id) ||
    typeof data.runtimeVersion !== 'string' ||
    data.runtimeVersion.length === 0 ||
    !gitHash
  ) {
    throw new Error('The main update has no verified commit or runtime. Nothing was loaded.');
  }
  return { id: data.id, runtime: data.runtimeVersion, gitHash };
}

export function parsePreviewManifest(body: string, contentType: string): PreviewManifest {
  if (!body.trim())
    throw new Error('No compatible main update is published for this APK. Install a dev-client APK built from current main.');
  if (contentType.toLowerCase().startsWith('multipart/mixed')) {
    const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    const separator = boundary?.[1] ?? boundary?.[2];
    if (!separator) throw new Error('The update manifest has no multipart boundary.');
    const part = body.split(`--${separator}`).find((entry) => /content-disposition:[^\r\n]*\bname="manifest"/i.test(entry));
    const json = part
      ?.split(/\r?\n\r?\n/)
      .slice(1)
      .join('\n\n')
      .trim();
    if (!json) throw new Error('No compatible main update was returned for this APK.');
    return manifestIdentity(JSON.parse(json));
  }
  return manifestIdentity(JSON.parse(body));
}

export function statusUrl(ref: string): string {
  if (ref !== 'main' && !SHA.test(ref)) throw new Error('Invalid main update commit.');
  return `${STATUS_URL}/${ref}/status`;
}

export function previewFromStatus(value: unknown): { gitHash: string; url: string } {
  const data = record(value);
  if (typeof data.sha !== 'string' || !SHA.test(data.sha) || !Array.isArray(data.statuses))
    throw new Error('Could not verify the main commit.');
  const preview = data.statuses.map(record).find((entry) => entry.context === 'Preview');
  if (preview?.state !== 'success' || typeof preview.target_url !== 'string')
    throw new Error('The main update is not published yet. Try again after its Preview check finishes.');
  const launcher = new URL(preview.target_url);
  if (launcher.origin !== BUNDLER_ORIGIN || launcher.pathname !== PREVIEW_LAUNCHER_PATH)
    throw new Error('The main preview link is not a Stage launcher.');
  return { gitHash: data.sha, url: immutablePreviewUrl(launcher.searchParams.get('u') ?? '') };
}

function immutablePreviewUrl(url: string): string {
  const target = new URL(url);
  const prefix = `${new URL(PROJECT_URL).pathname}/group/`;
  if (
    target.origin !== 'https://u.expo.dev' ||
    !target.pathname.startsWith(prefix) ||
    !UUID.test(target.pathname.slice(prefix.length)) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  ) {
    throw new Error('The main preview link is not an immutable Stage update.');
  }
  return target.toString();
}

export function freshUrl(url: string, stamp: number): string {
  const target = new URL(url);
  target.searchParams.set('refresh', String(stamp));
  return target.toString();
}

export function compatibleMainUrl(runtime: string, platform: string): string {
  const target = new URL(PROJECT_URL);
  target.searchParams.set('channel-name', 'main');
  target.searchParams.set('runtime-version', runtime);
  target.searchParams.set('platform', platform);
  return target.toString();
}
