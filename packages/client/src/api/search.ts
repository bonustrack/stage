import { isAddressLike, isDomainLike, resolveDomain } from '../stamp/resolve';

export interface SearchResolution {
  status: 'idle' | 'resolving' | 'resolved' | 'missed';
  address: string | null;
}

export const IDLE_RESOLUTION: SearchResolution = { status: 'idle', address: null };

export type SearchResolutionStep =
  | { kind: 'sync'; resolution: SearchResolution }
  | { kind: 'async'; query: string; resolve: () => Promise<SearchResolution> };

export function resolveSearchStep(rawQuery: string): SearchResolutionStep {
  const v = rawQuery.trim();
  if (!v) return { kind: 'sync', resolution: { status: 'idle', address: null } };
  if (isAddressLike(v)) {
    return { kind: 'sync', resolution: { status: 'resolved', address: v } };
  }
  if (!isDomainLike(v)) {
    return { kind: 'sync', resolution: { status: 'idle', address: null } };
  }
  return {
    kind: 'async',
    query: v,
    resolve: async (): Promise<SearchResolution> => {
      const addr = await resolveDomain(v);
      return addr
        ? { status: 'resolved', address: addr }
        : { status: 'missed', address: null };
    },
  };
}
