
import { Platform } from 'react-native';

export interface NodejsChannel {
  send: (event: string, ...args: unknown[]) => void;
  post: (event: string, payload: unknown) => void;
  addListener: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners?: (event: string) => void;
}

export interface NodejsMobileModule {
  start: (mainFileName: string) => void;
  channel: NodejsChannel;
}

interface RawModule {
  default?: NodejsMobileModule;
  start?: NodejsMobileModule['start'];
  channel?: NodejsChannel;
}

let resolved = false;
let cached: NodejsMobileModule | null = null;

export function loadNodejsMobile(): NodejsMobileModule | null {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = null);
  try {
    const mod = require('nodejs-mobile-react-native') as RawModule;
    const candidate = mod.default ?? (mod.start && mod.channel ? (mod as NodejsMobileModule) : null);
    cached = candidate && typeof candidate.start === 'function' ? candidate : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isNodejsMobilePresent(): boolean {
  return loadNodejsMobile() != null;
}
