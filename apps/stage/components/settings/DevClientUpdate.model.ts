import type { MainUpdate } from '../../lib/devClientUpdates.model';

export function mainUpdateMessage(update: MainUpdate, loaded: string | null): string {
  const selected = update.gitHash.slice(0, 7);
  const current = loaded === update.gitHash ? `Compatible main ${selected} is already loaded.` : `Load compatible main ${selected}?`;
  if (update.runtime === update.latest.runtime)
    return `${current} The launcher will check the server again. Your accounts and messages stay.`;
  return `Latest main ${update.latest.gitHash.slice(0, 7)} needs a new dev-client APK (runtime ${update.latest.runtime.slice(0, 8)}). This APK uses ${update.runtime.slice(0, 8)} and can only load compatible main ${selected}. Reload that update? Your accounts and messages stay.`;
}
