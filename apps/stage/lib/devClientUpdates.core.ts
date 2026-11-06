import {
  compatibleMainUrl,
  freshUrl,
  parsePreviewManifest,
  previewFromStatus,
  previewHistoryUrl,
  previewsFromHistory,
  statusUrl,
  type MainUpdate,
  type PreviewManifest,
} from '../components/settings/DevClientUpdate.model';

export type UpdateRequest = (url: string, headers: Record<string, string>) => Promise<{ body: string; contentType: string }>;

export async function findCompatibleMainUpdate(
  request: UpdateRequest,
  runtime: string,
  platform: string,
  stamp: number,
): Promise<MainUpdate> {
  if (!runtime || (platform !== 'android' && platform !== 'ios'))
    throw new Error('This dev client has no known native runtime. Nothing was loaded.');
  const manifestHeaders = {
    Accept: 'multipart/mixed',
    'Expo-Protocol-Version': '1',
    'Expo-Platform': platform,
    'Expo-Runtime-Version': runtime,
  };
  async function preview(ref: string): Promise<{ gitHash: string; url: string }> {
    const response = await request(freshUrl(statusUrl(ref), stamp), { Accept: 'application/vnd.github+json' });
    return previewFromStatus(JSON.parse(response.body));
  }
  async function manifest(url: string): Promise<PreviewManifest> {
    const response = await request(freshUrl(url, stamp), manifestHeaders);
    return parsePreviewManifest(response.body, response.contentType);
  }
  const latestPreview = await preview('main');
  const latest = await manifest(latestPreview.url);
  if (latest.gitHash !== latestPreview.gitHash) throw new Error('The main preview does not match its commit. Nothing was loaded.');
  const compatible = await manifest(compatibleMainUrl(runtime, platform));
  verifyChannelManifest(compatible, latest, runtime);
  const selectedPreview = compatible.gitHash === latestPreview.gitHash ? latestPreview : await preview(compatible.gitHash);
  const pinned = selectedPreview.url === latestPreview.url ? latest : await manifest(selectedPreview.url);
  if (matchesPinnedManifest(pinned, compatible, selectedPreview.gitHash, runtime)) return { ...pinned, url: selectedPreview.url, latest };
  const url = await findPinnedPreview(request, manifest, compatible, selectedPreview.url, stamp);
  return { ...compatible, url, latest: latest.runtime === runtime ? compatible : latest };
}

function verifyChannelManifest(compatible: PreviewManifest, latest: PreviewManifest, runtime: string): void {
  if (compatible.runtime !== runtime) throw new Error('The main update is incompatible with this APK. Install a matching dev-client APK.');
  if (latest.runtime === runtime && compatible.gitHash !== latest.gitHash)
    throw new Error('The main deployment changed during the check. Please try again.');
}

function matchesPinnedManifest(pinned: PreviewManifest, compatible: PreviewManifest, selectedHash: string, runtime: string): boolean {
  return (
    selectedHash === compatible.gitHash &&
    pinned.id === compatible.id &&
    pinned.gitHash === compatible.gitHash &&
    pinned.runtime === runtime
  );
}

async function findPinnedPreview(
  request: UpdateRequest,
  manifest: (url: string) => Promise<PreviewManifest>,
  compatible: PreviewManifest,
  attempted: string,
  stamp: number,
): Promise<string> {
  const seen = new Set([attempted]);
  for (let page = 1; page <= 3; page += 1) {
    const response = await request(freshUrl(previewHistoryUrl(compatible.gitHash, page), stamp), { Accept: 'application/vnd.github+json' });
    const history: unknown = JSON.parse(response.body);
    for (const preview of previewsFromHistory(history, compatible.gitHash)) {
      if (seen.has(preview.url)) continue;
      if (seen.size >= 10) break;
      seen.add(preview.url);
      const pinned = await manifest(preview.url);
      if (matchesPinnedManifest(pinned, compatible, preview.gitHash, compatible.runtime)) return preview.url;
    }
    if (!Array.isArray(history) || history.length < 100 || seen.size >= 10) break;
  }
  throw new Error('Could not verify an immutable compatible main update. Nothing was loaded.');
}
