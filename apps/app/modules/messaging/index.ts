/** @file Messaging facade: the single import point for the app's XMTP messaging surface, re-exporting the lib/xmtp barrel plus the labels/github surfaces so component code never reaches into `lib/xmtp.*` internals (enforced by an ESLint no-restricted-imports rule). */

export * from '../../lib/xmtp';
export * from '../../lib/xmtp.labels';
export * from '../../lib/xmtp.labels.suggest';
export * from '../../lib/xmtp.github';

/** Stage 2 facade surfaces moving lib internals behind the facade with zero behavior change: account (atomic switch + active-account hook/signal), cache (channels-list + session caches), conversation (domain type + summarise adapters). */
export * from './account';
export * from './cache';
export * from './conversation';

/** Stage-1 cache unification: typed Query key factory + the convMeta / channels hooks backed by TanStack Query. The old stores (channelsCache / feedCache) stay alive alongside; this is a parallel-path migration. */
export * from './queries';
export * from './channelsQuery';
export * from './streamSync';
export * from './feedQuery';
