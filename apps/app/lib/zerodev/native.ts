
import { Platform } from 'react-native';

let resolved = false;
let cached = false;

function probe(): boolean {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = false);
  try {
    const mod: unknown = require('react-native-passkeys');
    cached =
      typeof mod === 'object' &&
      mod !== null &&
      'create' in mod &&
      typeof mod.create === 'function' &&
      'get' in mod &&
      typeof mod.get === 'function';
  } catch {
    cached = false;
  }
  return cached;
}

export function passkeysAvailable(): boolean {
  return probe();
}
