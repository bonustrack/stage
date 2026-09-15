import { describe, expect, test } from 'bun:test';
import { APP_HOME } from '../src/assets';
import { deepLinkIn, desktopRouteUrl, sameSite, siteBaseFor } from '../src/links';

describe('siteBaseFor', () => {
  test('serves the bundled UI unless a dev server override is given', () => {
    expect(siteBaseFor(undefined)).toBe(APP_HOME);
    expect(siteBaseFor('')).toBe(APP_HOME);
    expect(siteBaseFor('http://localhost:8080')).toBe('http://localhost:8080');
  });
});

describe('deep links', () => {
  test('finds the stage:// argument regardless of case', () => {
    expect(deepLinkIn(['Stage.exe', 'STAGE://channel/abc'])).toBe('STAGE://channel/abc');
    expect(deepLinkIn(['Stage.exe'])).toBeNull();
  });

  test('maps a stage:// link onto the hash router of the bundled UI', () => {
    expect(desktopRouteUrl(APP_HOME, 'stage://channel/abc?m=1')).toBe('stage-app://stage.box/#/channel/abc?m=1');
    expect(desktopRouteUrl('http://localhost:8080', 'stage://profile/boorger')).toBe('http://localhost:8080/#/profile/boorger');
    expect(desktopRouteUrl(APP_HOME, 'stage://')).toBe(APP_HOME);
    expect(desktopRouteUrl(APP_HOME, 'https://evil.example/#/x')).toBe(APP_HOME);
  });
});

describe('sameSite', () => {
  test('compares scheme and host, also for the custom app scheme', () => {
    expect(sameSite('stage-app://stage.box/#/settings', APP_HOME)).toBe(true);
    expect(sameSite('https://stage.box/', APP_HOME)).toBe(false);
    expect(sameSite('http://localhost:8080/#/x', 'http://localhost:8080')).toBe(true);
    expect(sameSite('not a url', APP_HOME)).toBe(false);
  });
});
