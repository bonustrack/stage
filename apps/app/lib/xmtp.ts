/** Local XMTP client lifecycle for the mobile app — public barrel.
 *
 *  This module was split (phase-2 lint hardening) into cohesive siblings under
 *  `lib/`; every symbol the app imports from `./xmtp` is re-exported here so the
 *  ~40 existing import sites keep resolving unchanged:
 *
 *    - xmtp.types.ts        types + pure string helpers (lineOfConv, shortAddress…)
 *    - xmtp.state.ts        shared client-scoped mutable state + caches (internal)
 *    - xmtp.codecs.ts       XMTP_CODECS registry + Signer adapters (internal)
 *    - xmtp.client.ts       client create/cache/build + db key + convOfLine
 *    - xmtp.identity.ts     inbox→eth resolution + member-address helpers
 *    - xmtp.conv.ts         openDm / message-request + consent helpers
 *    - xmtp.groups.ts       createGroup / addGroupMembers / leaveGroupConv
 *    - xmtp.envelope.ts     envelopeOfXmtpMessage (decoded message → HistoryEntry)
 *    - xmtp.messages.ts     send helpers (+ re-exports the envelope mapper)
 *    - xmtp.swarm.ts        swarm gateway plumbing + file materialisation
 *    - xmtp.attachments.ts  remote-attachment send / resolve (+ swarmToHttp)
 *    - xmtp.stream.ts       single global message stream + backstops
 *    - xmtp.feed.ts         useXmtpFeed
 *
 *  First launch:
 *    `Client.createRandom({env})` → native SDK generates a wallet, persists keys in its
 *    internal sqlite at `dbDirectory`. We capture the resulting address and stash it in
 *    expo-secure-store so subsequent launches know which inbox to rebuild.
 *
 *  Subsequent launches:
 *    `Client.build(address, {env, dbDirectory})` → reuses the on-disk wallet.
 *
 *  Key material never crosses the JS bridge — the SDK keeps it native side, backed by the
 *  device keystore on Android and the secure enclave on iOS. */

export type {
  XmtpEnv, XmtpConsent, ConversationVersion, XmtpFeedStatus,
  LocalAttachmentInput, StreamMsg,
} from './xmtp.types';
export {
  XMTP_USER_PREFIX, lineOfConv, convIdOfLine, shortAddress, stampBoxAvatarUrl,
} from './xmtp.types';

export {
  getOrCreateXmtpClient, ensureActiveAccount, switchToAccount, getCachedXmtpClient, waitForXmtpReady, deleteAccount,
  resetXmtpClient, getLastReadNs, setLastReadNs, markConvReadSynced,
  markConvUnreadSynced, syncPreferences, convOfLine,
} from './xmtp.client';

export {
  primeInboxEthCache, peerEthAddressOfDm, memberInboxToAddressMap, groupMemberEthAddresses,
} from './xmtp.identity';

export {
  openDmWithAddress, listRequestConvs, acceptRequestConv, blockRequestConv,
  streamConvConsent, syncConsent,
} from './xmtp.conv';

export { createGroup, addGroupMembers, leaveGroupConv } from './xmtp.groups';

export {
  envelopeOfXmtpMessage, xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpVote, xmtpReply, xmtpSendAttachment,
} from './xmtp.messages';

export {
  swarmToHttp, xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, fileUriToBase64,
} from './xmtp.attachments';

export { subscribeAllMessages } from './xmtp.stream';
export { useXmtpFeed } from './xmtp.feed';
