import { describe, expect, test } from 'bun:test';
import type { Release } from '@stage-labs/client/api/releases';
import { LATEST_RELEASE_URL, downloadLinks } from '../components/landing/Landing.model';

const dl = 'https://github.com/bonustrack/stage/releases/download';
const asset = (tag: string, name: string) => ({ name, url: `${dl}/${tag}/${name}` });

const releases: Release[] = [
  { tag: 'dev-client', prerelease: true, assets: [asset('dev-client', 'stage.apk')] },
  { tag: 'v0.1.2', prerelease: false, assets: [asset('v0.1.2', 'stage.apk')] },
  {
    tag: 'desktop-v0.1.0', prerelease: false,
    assets: [
      asset('desktop-v0.1.0', 'Stage-0.1.0-mac-arm64.dmg'),
      asset('desktop-v0.1.0', 'Stage-0.1.0-mac-arm64.zip'),
      asset('desktop-v0.1.0', 'Stage-0.1.0-linux-x86_64.AppImage'),
      asset('desktop-v0.1.0', 'Stage-0.1.0-linux-amd64.deb'),
      asset('desktop-v0.1.0', 'Stage-0.1.0-win-x64.exe'),
    ],
  },
];

const hrefOf = (platform: string, list = releases) => downloadLinks(list).find((l) => l.platform === platform)?.href;

describe('downloadLinks', () => {
  test('lists the platforms in order, falls back to the latest release page, and has no iOS store yet', () => {
    const links = downloadLinks();
    expect(links.map((l) => l.platform)).toEqual(['ios', 'android', 'macos', 'windows', 'linux']);
    expect(links.filter((l) => l.platform !== 'ios').every((l) => l.href === LATEST_RELEASE_URL)).toBe(true);
  });

  test('picks each installer from the newest stable release that ships it', () => {
    expect(hrefOf('android')).toBe(`${dl}/v0.1.2/stage.apk`);
    expect(hrefOf('macos')).toBe(`${dl}/desktop-v0.1.0/Stage-0.1.0-mac-arm64.dmg`);
    expect(hrefOf('windows')).toBe(`${dl}/desktop-v0.1.0/Stage-0.1.0-win-x64.exe`);
    expect(hrefOf('linux')).toBe(`${dl}/desktop-v0.1.0/Stage-0.1.0-linux-x86_64.AppImage`);
    expect(hrefOf('ios')).toBeNull();
  });

  test('prefers the universal mac build and skips pre-releases', () => {
    const list: Release[] = [
      { tag: 'v0.2.0-beta', prerelease: true, assets: [asset('v0.2.0-beta', 'Stage-0.2.0-mac-universal.dmg')] },
      {
        tag: 'v0.1.3', prerelease: false,
        assets: [asset('v0.1.3', 'Stage-0.1.3-mac-arm64.dmg'), asset('v0.1.3', 'Stage-0.1.3-mac-universal.dmg')],
      },
    ];
    expect(hrefOf('macos', list)).toBe(`${dl}/v0.1.3/Stage-0.1.3-mac-universal.dmg`);
  });
});
