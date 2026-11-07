import { BUNDLER_ORIGIN, EAS_UPDATES_URL, MAIN_BRANCH, PREVIEW_LAUNCHER_PATH, easManifestUrl } from '@stage-labs/client/endpoints';

const EAS_UPDATES = new URL(EAS_UPDATES_URL);
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
  const gitHash = record(record(record(record(manifest).extra).expoClient).extra).gitHash;
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
  if (ref !== MAIN_BRANCH && !SHA.test(ref)) throw new Error('Invalid main update commit.');
  return `${STATUS_URL}/${ref}/status`;
}

export function previewFromStatus(value: unknown): { gitHash: string; url: string } {
  const data = record(value);
  if (typeof data.sha !== 'string' || !SHA.test(data.sha) || !Array.isArray(data.statuses))
    throw new Error('Could not verify the main commit.');
  const preview = preferredPreviewStatus(data.statuses);
  if (preview?.state !== 'success' || typeof preview.target_url !== 'string')
    throw new Error('The main update is not published yet. Try again after its Preview check finishes.');
  const launcher = new URL(preview.target_url);
  if (launcher.origin !== BUNDLER_ORIGIN || launcher.pathname !== PREVIEW_LAUNCHER_PATH)
    throw new Error('The main preview link is not a Stage launcher.');
  return { gitHash: data.sha, url: immutablePreviewUrl(launcher.searchParams.get('u') ?? '') };
}

function preferredPreviewStatus(statuses: unknown[]): Record<string, unknown> | undefined {
  const entries = statuses.map(record);
  return entries.find((entry) => entry.context === 'Main preview') ?? entries.find((entry) => entry.context === 'Preview');
}

export function previewHistoryUrl(gitHash: string, page: number): string {
  if (!SHA.test(gitHash)) throw new Error('Invalid main update commit.');
  return `${STATUS_URL}/${gitHash}/statuses?per_page=100&page=${page}`;
}

export function previewsFromHistory(value: unknown, gitHash: string): { gitHash: string; url: string }[] {
  if (!Array.isArray(value)) throw new Error('Could not verify the main preview history. Nothing was loaded.');
  return value
    .map(record)
    .filter((entry) => (entry.context === 'Main preview' || entry.context === 'Preview') && entry.state === 'success')
    .map((entry) => previewFromStatus({ sha: gitHash, statuses: [entry] }));
}

function immutablePreviewUrl(url: string): string {
  const target = new URL(url);
  const prefix = `${EAS_UPDATES.pathname}/group/`;
  if (
    target.origin !== EAS_UPDATES.origin ||
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
  return easManifestUrl({ branch: MAIN_BRANCH, runtime, platform });
}
