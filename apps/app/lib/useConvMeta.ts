/** Back-compat shim. The conversation-metadata query moved behind the messaging
 *  facade in stage 1 of the cache unification (key + fetcher live in
 *  modules/messaging/queries + convMeta.fetch). Existing call sites still import
 *  `useConvMeta` / `ConvMeta` from here; this re-exports the facade version so
 *  the dedup (chat-view topnav + group screen share ONE query) takes effect
 *  without touching every consumer. */

export { useConvMeta, type ConvMeta } from '../modules/messaging/queries';
