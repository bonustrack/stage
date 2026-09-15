import type { BrandIconName } from '@stage-labs/kit/icons';
import type { Release } from '@stage-labs/client/api/releases';

export type DownloadPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux';

export interface DownloadLink {
  platform: DownloadPlatform;
  label: string;
  icon: BrandIconName;
  href: string | null;
}

export const RELEASES_REPO = { owner: 'bonustrack', repo: 'stage' } as const;
const RELEASES_URL = `https://github.com/${RELEASES_REPO.owner}/${RELEASES_REPO.repo}/releases`;
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`;
export const IOS_STORE_URL: string | null = null;

const ASSET_PATTERNS: Record<Exclude<DownloadPlatform, 'ios'>, RegExp[]> = {
  android: [/\.apk$/i],
  macos: [/-mac-universal\.dmg$/i, /-mac-arm64\.dmg$/i, /\.dmg$/i],
  windows: [/-win-x64\.exe$/i, /\.exe$/i],
  linux: [/\.AppImage$/i],
};

function assetUrl(releases: Release[], patterns: RegExp[]): string | null {
  for (const release of releases) {
    if (release.prerelease) continue;
    for (const pattern of patterns) {
      const asset = release.assets.find((candidate) => pattern.test(candidate.name));
      if (asset !== undefined) return asset.url;
    }
  }
  return null;
}

export function downloadLinks(releases: Release[] = []): DownloadLink[] {
  const href = (platform: Exclude<DownloadPlatform, 'ios'>): string =>
    assetUrl(releases, ASSET_PATTERNS[platform]) ?? LATEST_RELEASE_URL;
  return [
    { platform: 'ios', label: 'iOS', icon: 'brandApple', href: IOS_STORE_URL },
    { platform: 'android', label: 'Android', icon: 'brandAndroid', href: href('android') },
    { platform: 'macos', label: 'macOS', icon: 'brandApple', href: href('macos') },
    { platform: 'windows', label: 'Windows', icon: 'brandWindows', href: href('windows') },
    { platform: 'linux', label: 'Linux', icon: 'brandLinux', href: href('linux') },
  ];
}
