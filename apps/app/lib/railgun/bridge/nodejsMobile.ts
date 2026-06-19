/** @file Lazy, guarded feature-detection of `nodejs-mobile-react-native`, typing the channel subset the bridge drives and returning null (never throwing) on web or binaries without the native runtime. */

/*
 * Lazy, guarded feature-detection of `nodejs-mobile-react-native`.
 *
 *  Mirrors lib/railgun/native.ts exactly: the module is required LAZILY behind a
 *  try/catch so the Metro bundler never has to resolve it on a build where the
 *  native runtime isn't linked (plain Expo/Hermes), and so tsc/eslint stay clean
 *  without the dep installed. Returns null when absent; every caller degrades to
 *  the existing "needs the new app build" state instead of throwing.
 *
 *  The real channel surface (per nodejs-mobile-react-native): a default export
 *  with `.start(mainFile)`, `.startWithScript(...)`, and a `.channel` carrying
 *  `.send(event, ...args)` + `.addListener(event, cb)` + `.post`. We type only
 *  the subset the bridge drives.
 */
import { Platform } from 'react-native';

/** The bi-directional message channel exposed by nodejs-mobile-react-native. */
export interface NodejsChannel {
  send: (event: string, ...args: unknown[]) => void;
  post: (event: string, payload: unknown) => void;
  addListener: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeAllListeners?: (event: string) => void;
}

/** The subset of the nodejs-mobile-react-native default export we use. */
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

/** Lazily resolve the nodejs-mobile runtime. Returns null on web or a binary without the native module. Memoized; never throws; never statically referenced so Metro can't fail to resolve it. */
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

/** True when the embedded Node runtime is present in THIS binary. iOS/Android only; never true on web. Memoized. */
export function isNodejsMobilePresent(): boolean {
  return loadNodejsMobile() != null;
}
