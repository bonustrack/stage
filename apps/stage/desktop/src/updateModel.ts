export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const RELEASES_REPO = 'bonustrack/stage';

export function installsInPlace(platform: string): boolean {
  return platform !== 'darwin';
}

export function releasePageUrl(version: string): string {
  return `https://github.com/${RELEASES_REPO}/releases/tag/v${version}`;
}

export function releaseTag(version: string): string {
  return `v${version}`;
}
