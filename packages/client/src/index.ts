/** @file Public entrypoint barrel for @stage-labs/client re-exporting every framework-agnostic Metro client module (pure TypeScript, no Vue/React/RN); narrow subpath exports are also available. */

export * from './types';
export * from './profile/snapshot';
export * from './xmtp/humanize';
export * from './xmtp/poll';
/** Stage 3: framework-agnostic messaging logic (line URIs, envelope mapping, outbound payload builders, codec wire helpers, inbox->eth cache rule). */
export * from './xmtp/line';
export * from './xmtp/envelope';
export * from './xmtp/builders';
export * from './xmtp/codecs';
export * from './xmtp/inboxCache';
export * from './embed/detect';
export * from './stamp/resolve';
export * from './x402/challenge';

export * from './api';

/** Stage 2: framework-agnostic identity glue + wallet/accounts pure logic. */
export * from './identity/format';
export * from './identity/peerProfiles';
export * from './wallet/format';
export * from './wallet/assets';
export * from './wallet/balances';
export * from './accounts/types';
export * from './accounts/keys';
export * from './accounts/registry';

/** Stage 4: framework-agnostic Railgun bridge protocol - typed request/response FRAME builders for shield/private-transfer/unshield plus bigint wire-encoding; the native nodejs-mobile bridge stays in apps/app behind the injected RailgunTransport. */
export * from './railgun';
