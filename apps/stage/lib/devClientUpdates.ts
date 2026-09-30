import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { freshUrl, loadedCommit, type MainUpdate } from '../components/settings/DevClientUpdate.model';
import { findCompatibleMainUpdate, type UpdateRequest } from './devClientUpdates.core';

interface DevLauncher { loadApp(url: string): Promise<void> }
const launcher = requireOptionalNativeModule<DevLauncher>('ExpoDevLauncher');

export function devClientInfo(): { runtime: string | null; updateId: string | null; gitHash: string | null } | null {
  return launcher ? { runtime: Updates.runtimeVersion, updateId: Updates.updateId, gitHash: loadedCommit(Updates.manifest) } : null;
}

const requestUpdate: UpdateRequest = async (url, headers) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 15000);
  try {
    const response = await fetch(url, {
      headers: { ...headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Could not check the main update (HTTP ${response.status}). Nothing was loaded.`);
    return { body: await response.text(), contentType: response.headers.get('content-type') ?? '' };
  } finally {
    clearTimeout(timeout);
  }
};

export async function checkMainUpdate(): Promise<MainUpdate> {
  if (!launcher || !Updates.runtimeVersion) throw new Error('A dev-client APK with a known runtime is required.');
  return findCompatibleMainUpdate(requestUpdate, Updates.runtimeVersion, Platform.OS, Date.now());
}

export async function loadMainUpdate(update: MainUpdate): Promise<void> {
  if (!launcher || update.runtime !== Updates.runtimeVersion) throw new Error('This update cannot run in the installed dev-client APK.');
  await launcher.loadApp(freshUrl(update.url, Date.now()));
}
