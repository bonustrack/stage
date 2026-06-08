/** Messaging facade - single import point for the app's XMTP messaging surface.
 *  Component code must import messaging symbols from here (`@/modules/messaging`)
 *  rather than reaching into the `lib/xmtp.*` internals; an ESLint
 *  `no-restricted-imports` rule enforces that boundary. Re-exports the lib/xmtp
 *  public barrel plus xmtp.labels / xmtp.labels.suggest / xmtp.github. */

export * from '../../lib/xmtp';
export * from '../../lib/xmtp.labels';
export * from '../../lib/xmtp.labels.suggest';
export * from '../../lib/xmtp.github';

/** Stage 2 facade surfaces. These move the corresponding lib internals behind
 *  the facade with zero behavior change; see each module's header.
 *    - account       atomic account switch + active-account hook/signal
 *    - cache         channels-list + session caches (re-export only)
 *    - conversation  ConversationView domain type + summarise adapters */
export * from './account';
export * from './cache';
export * from './conversation';

/** Stage-1 cache unification: typed Query key factory + the convMeta / channels
 *  hooks backed by TanStack Query. The old stores (channelsCache / feedCache)
 *  stay alive alongside; this is a parallel-path migration. */
export * from './queries';
export * from './channelsQuery';
export * from './streamSync';
export * from './feedQuery';
