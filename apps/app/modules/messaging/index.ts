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
 *    - lib/xmtp.preview        group preview link read/write
 */

export * from '../../lib/xmtp';
export * from '../../lib/xmtp.labels';
export * from '../../lib/xmtp.labels.suggest';
export * from '../../lib/xmtp.github';
export * from '../../lib/xmtp.preview';
