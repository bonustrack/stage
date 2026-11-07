import { requireOptionalNativeModule } from 'expo';
import { NativeModules, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { freshUrl, isDevClientLauncher, loadedCommit, type MainUpdate } from './devClientUpdates.model';
import { findCompatibleMainUpdate, type UpdateRequest } from './devClientUpdates.core';
import { fetchWithin } from '@stage-labs/client/timing';

interface DevLauncher {
  loadApp(url: string): Promise<void>;
}
const installedLauncher = requireOptionalNativeModule<DevLauncher>('ExpoDevLauncher');
const launcher = isDevClientLauncher(NativeModules.EXDevLauncher, installedLauncher) ? installedLauncher : null;

export function devClientInfo(): { runtime: string | null; updateId: string | null; gitHash: string | null } | null {
  return launcher ? { runtime: Updates.runtimeVersion, updateId: Updates.updateId, gitHash: loadedCommit(Updates.manifest) } : null;
}

const UPDATE_CHECK_TIMEOUT_MS = 15_000;

const requestUpdate: UpdateRequest = (url, headers) =>
  fetchWithin(
    url,
    { headers: { ...headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, cache: 'no-store' },
    { timeoutMs: UPDATE_CHECK_TIMEOUT_MS },
    async (response) => {
      if (!response.ok) throw new Error(`Could not check the main update (HTTP ${response.status}). Nothing was loaded.`);
      return { body: await response.text(), contentType: response.headers.get('content-type') ?? '' };
    },
  );

export async function checkMainUpdate(): Promise<MainUpdate> {
  if (!launcher || !Updates.runtimeVersion) throw new Error('A dev-client APK with a known runtime is required.');
  return findCompatibleMainUpdate(requestUpdate, Updates.runtimeVersion, Platform.OS, Date.now());
}

export async function loadMainUpdate(update: MainUpdate): Promise<void> {
  if (!launcher || update.runtime !== Updates.runtimeVersion) throw new Error('This update cannot run in the installed dev-client APK.');
  await launcher.loadApp(freshUrl(update.url, Date.now()));
}
