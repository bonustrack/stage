import {
  compatibleMainUrl, freshUrl, parsePreviewManifest, previewFromStatus, statusUrl,
  type MainUpdate, type PreviewManifest,
} from '../components/settings/DevClientUpdate.model';

export type UpdateRequest = (url: string, headers: Record<string, string>) => Promise<{ body: string; contentType: string }>;

export async function findCompatibleMainUpdate(request: UpdateRequest, runtime: string, platform: string, stamp: number): Promise<MainUpdate> {
  if (!runtime || (platform !== 'android' && platform !== 'ios')) throw new Error('This dev client has no known native runtime. Nothing was loaded.');
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
  const selectedPreview = compatible.id === latest.id ? latestPreview : await preview(compatible.gitHash);
  const pinned = compatible.id === latest.id ? latest : await manifest(selectedPreview.url);
  verifyPinnedManifest(pinned, compatible, selectedPreview.gitHash, runtime);
  return { ...pinned, url: selectedPreview.url, latest };
}

function verifyChannelManifest(compatible: PreviewManifest, latest: PreviewManifest, runtime: string): void {
  if (compatible.runtime !== runtime) throw new Error('The main update is incompatible with this APK. Install a matching dev-client APK.');
  if (latest.runtime === runtime && compatible.id !== latest.id) throw new Error('The main deployment changed during the check. Please try again.');
}

function verifyPinnedManifest(pinned: PreviewManifest, compatible: PreviewManifest, selectedHash: string, runtime: string): void {
  if (selectedHash !== compatible.gitHash || pinned.id !== compatible.id || pinned.gitHash !== compatible.gitHash || pinned.runtime !== runtime) {
    throw new Error('Could not verify an immutable compatible main update. Nothing was loaded.');
  }
}
