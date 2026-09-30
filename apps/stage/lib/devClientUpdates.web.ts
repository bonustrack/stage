import type { MainUpdate } from '../components/settings/DevClientUpdate.model';

export function devClientInfo(): { runtime: string | null; updateId: string | null; gitHash: string | null } | null {
  return null;
}

export function checkMainUpdate(): Promise<MainUpdate> {
  return Promise.reject(new Error('Main updates are only available in the native dev client.'));
}

export function loadMainUpdate(update: MainUpdate): Promise<void> {
  void update;
  return Promise.reject(new Error('Main updates are only available in the native dev client.'));
}
