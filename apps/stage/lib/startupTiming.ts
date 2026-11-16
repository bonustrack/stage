import type { StartupMarks } from '../components/settings/startupTiming.model';
import { ignored } from './errorPolicy';

interface NativeStartupTiming {
  startTime?: number;
  executeJavaScriptBundleEntryPointStart?: number;
  endTime?: number;
}

let chatsShownAt: number | undefined;

export function markChatsShown(): void {
  chatsShownAt ??= performance.now();
}

function nativeStartupTiming(): NativeStartupTiming {
  const perf = performance as Performance & { rnStartupTiming?: NativeStartupTiming };
  try {
    return perf.rnStartupTiming ?? {};
  } catch (e) {
    return ignored<NativeStartupTiming>({}, 'probe')(e);
  }
}

export function startupMarks(): StartupMarks {
  const native = nativeStartupTiming();
  return {
    processStart: native.startTime,
    bundleStart: native.executeJavaScriptBundleEntryPointStart,
    bundleEnd: native.endTime,
    chatsShown: chatsShownAt,
  };
}
