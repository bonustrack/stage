import { createAppDataWriter, type AppDataWriter } from '@stage-labs/client/xmtp/channelMeta';
import { makeValue } from './storeCore';
import { resetFeed } from './feed/cache';
import { attempt } from './errorPolicy';
import { sleep } from '@stage-labs/client/timing';
import { AccountChangedError } from './accountSelection';

export const inboxEthCache = new Map<string, string>();

let activeConvId: string | null = null;

export function setActiveConvId(convId: string | null): void {
  activeConvId = convId ? convId.toLowerCase() : null;
}

export function isActiveConv(convId: string | null | undefined): boolean {
  if (!convId || !activeConvId) return false;
  return convId.toLowerCase() === activeConvId;
}

const bootstrap = makeValue<'idle' | 'registering'>('idle');

export const getXmtpBootstrapPhase = bootstrap.get;

export const useXmtpBootstrapPhase = bootstrap.use;

export async function whileRegistering<T>(work: () => Promise<T>): Promise<T> {
  bootstrap.set('registering');
  try {
    return await work();
  } finally {
    bootstrap.set('idle');
  }
}

let globalStreamTeardown: (() => void) | null = null;
export function registerGlobalStreamTeardown(fn: () => void): void {
  globalStreamTeardown = fn;
}

let appDataWriter = createAppDataWriter();

export function channelMetaWriter(): AppDataWriter {
  return appDataWriter;
}

export function resetSharedXmtpState(): void {
  appDataWriter.close();
  appDataWriter = createAppDataWriter();
  globalStreamTeardown?.();
  resetFeed();
  inboxEthCache.clear();
}

const READY_CAP_MS = 60_000;

export interface ClientSlot<C> {
  get: () => C | null;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  waitForReady: () => Promise<boolean>;
  reset: () => void;
  discard: (client: C) => void;
}

export function createClientSlot<C>(onReset: () => void, close?: (client: C) => void): ClientSlot<C> {
  let cached: C | null = null;
  let inFlight: Promise<C> | null = null;
  let generation = 0;
  const discard = (client: C): void => {
    if (close)
      attempt(() => {
        close(client);
      }, 'cleanup');
  };
  return {
    get: () => cached,
    getOrCreate: async (create) => {
      if (cached) return cached;
      if (inFlight) return inFlight;
      const started = generation;
      const pending = (async (): Promise<C> => {
        const client = await create();
        if (generation !== started) {
          discard(client);
          throw new AccountChangedError('The account changed while messaging was starting.');
        }
        cached = client;
        return client;
      })();
      inFlight = pending;
      try {
        return await pending;
      } finally {
        if (inFlight === pending) inFlight = null;
      }
    },
    waitForReady: async () => {
      const start = Date.now();
      while (cached === null && Date.now() - start < READY_CAP_MS) await sleep(250);
      return cached !== null;
    },
    reset: () => {
      if (cached) discard(cached);
      generation += 1;
      cached = null;
      inFlight = null;
      onReset();
    },
    discard,
  };
}
