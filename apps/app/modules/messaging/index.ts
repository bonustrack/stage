/** Messaging facade (stage 1, mechanical).
 *
 *  Single import point for the app's XMTP messaging surface. Component code must
 *  import messaging symbols from here (`@/modules/messaging` / relative) rather
 *  than reaching into the `lib/xmtp.*` internals directly; an ESLint
 *  `no-restricted-imports` rule enforces that boundary.
 *
 *  Stage 1 is purely mechanical: this barrel re-exports the existing public
 *  surface of `lib/xmtp.*` unchanged. No symbols are moved or renamed and there
 *  is zero behavior change. Stage 2 will move the internals behind this facade
 *  and add domain types + an AccountManager.
 *
 *  Surface re-exported:
 *    - lib/xmtp            client lifecycle, conv/group/message helpers, types,
 *                          identity, stream, feed, attachments (the existing
 *                          public barrel; it also re-exports lib/xmtp.types)
 *    - lib/xmtp.labels         group label read/write + permission error
 *    - lib/xmtp.labels.suggest label suggestions
 *    - lib/xmtp.github         group GitHub link read/write
 */

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
