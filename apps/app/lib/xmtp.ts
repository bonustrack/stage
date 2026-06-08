/** Local XMTP client lifecycle for the mobile app - public barrel. Re-exports
 *  the cohesive `xmtp.*` siblings so existing `./xmtp` import sites resolve
 *  unchanged.
 *
 *  Lifecycle: first launch `Client.createRandom({env})` has the native SDK
 *  generate a wallet + persist keys in its sqlite at `dbDirectory`; we stash the
 *  resulting address in expo-secure-store. Subsequent launches
 *  `Client.build(address, {env, dbDirectory})` reuse the on-disk wallet. Key
 *  material never crosses the JS bridge - the SDK keeps it native side, backed
 *  by the device keystore (Android) / secure enclave (iOS). */

export type {
  XmtpEnv, XmtpConsent, ConversationVersion, XmtpFeedStatus,
  LocalAttachmentInput, StreamMsg,
} from './xmtp.types';
export {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroConvIdOf, metroDmPeerOf,
  shortAddress, stampAvatarUrl,
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
  getConvConsentState, streamConvConsent, syncConsent,
} from './xmtp.conv';

export { createGroup, addGroupMembers, leaveGroupConv } from './xmtp.groups';

export {
  envelopeOfXmtpMessage, xmtpSendText, xmtpReact, xmtpSendPoll,
  xmtpSendSignatureRequest, xmtpSendSignatureReference, xmtpSendTxRequest,
  xmtpSendTxReference, xmtpVote, xmtpOpenAnswer, xmtpReply, xmtpSendAttachment,
} from './xmtp.messages';

export {
  swarmToHttp, xmtpSendMultiRemoteAttachment, resolveRemoteAttachment, fileUriToBase64,
} from './xmtp.attachments';

export { subscribeAllMessages } from './xmtp.stream';
export { useXmtpFeed } from './xmtp.feed';
